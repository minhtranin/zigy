//! CoreAudio audio capture for macOS
//! Uses AudioUnit framework for native macOS audio capture
//! Reference: Apple CoreAudio and AudioUnit documentation

const std = @import("std");

const macos = std.os.macos;
const kern_return_t = macos.kern_return_t;

const c = @cImport({
    @cDefine("COREAUDIO_FOUND", "1");
    @cInclude("CoreFoundation/CoreFoundation.h");
    @cInclude("AudioUnit/AudioUnit.h");
    @cInclude("AudioToolbox/AudioServices.h");
});

// CoreAudio constants
const kAudioUnitType_Output = @as(u32, 0x6f75746c); // 'auot'
const kAudioUnitSubType_HALOutput = @as(u32, 0x68616c6f); // 'halo'
const kAudioUnitManufacturer_Apple = @as(u32, 0x6170706c); // 'appl'

const kAudioObjectPropertyScopeInput = @as(u32, 0x01); // 'inp '
const kAudioObjectPropertyScopeOutput = @as(u32, 0x02); // 'outp'
const kAudioObjectPropertyScopeGlobal = @as(u32, 0x00); // 'glob'

const kAudioHardwarePropertyDefaultInputDevice = @as(u32, 0x6473696c); // 'dsil'
const kAudioHardwarePropertyDefaultOutputDevice = @as(u32, 0x64736f6c); // 'dsol'
const kAudioDevicePropertyStreamFormat = @as(u32, 0x66777462); // 'fwtf'
const kAudioDevicePropertyBufferFrameSize = @as(u32, 0x6273697a); // 'bsiz'

const kAudioFormatLinearPCM = @as(u32, 0x6c70636d); // 'lpcm'
const kLinearPCMFormatFlagIsSignedInteger = @as(u32, 1 << 1);
const kLinearPCMFormatFlagIsPacked = @as(u32, 1 << 3);
const kAudioFormatFlagsNativeEndian = @as(u32, 0 << 2);

const kAudioUnitProperty_StreamFormat = @as(u32, 10); // 'sfmt'
const kAudioUnitProperty_SetRenderCallback = @as(u32, 11); // 'rcbc'
const kAudioUnitProperty_EnableIO = @as(u32, 5); // 'enio'

const kAudioOutputUnitRange_Input = @as(u32, 1); // 1 for input element
const kAudioOutputUnitRange_Output = @as(u32, 0); // 0 for output element

const kAudioUnitRenderAction_DoNotCheckRenderArgs = @as(u32, 1 << 3);
const kAudioUnitRenderAction_PostRender = @as(u32 | 1 << 2);

pub const CoreAudioError = error{
    DeviceNotFound,
    FormatMismatch,
    InitializeFailed,
    StartFailed,
    ReadFailed,
    BufferError,
    PropertyError,
};

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Not supported on macOS (requires loopback which is complex)
};

/// Audio format specification
pub const AudioFormat = struct {
    sample_rate: u32,
    channels: u8 = 1, // Mono for speech recognition
    bits_per_sample: u16 = 16,

    fn toAudioStreamBasicDescription(self: AudioFormat) c.AudioStreamBasicDescription {
        return .{
            .mSampleRate = @floatFromInt(self.sample_rate),
            .mFormatID = kAudioFormatLinearPCM,
            .mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked | kAudioFormatFlagsNativeEndian,
            .mBytesPerPacket = self.channels * self.bits_per_sample / 8,
            .mFramesPerPacket = 1,
            .mBytesPerFrame = self.channels * self.bits_per_sample / 8,
            .mChannelsPerFrame = self.channels,
            .mBitsPerChannel = self.bits_per_sample,
            .mReserved = 0,
        };
    }
};

/// Audio property address
const AudioObjectPropertyAddress = extern struct {
    mSelector: u32,
    mScope: u32,
    mElement: u32,
};

/// CoreAudio audio capture using AudioUnit
pub const AudioCapture = struct {
    audio_unit: c.AudioUnit,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    buffer: []i16,
    buffer_size: usize,

    const Self = @This();

    /// Get the default input device ID
    fn getDefaultInputDevice() !c.AudioDeviceID {
        var device_id: c.AudioDeviceID = 0;
        var size = @sizeOf(c.AudioDeviceID);
        const prop_addr = AudioObjectPropertyAddress{
            .mSelector = kAudioHardwarePropertyDefaultInputDevice,
            .mScope = kAudioObjectPropertyScopeGlobal,
            .mElement = 0,
        };

        const status = c.AudioObjectGetPropertyData(
            c.kAudioObjectSystemObject,
            &prop_addr,
            0,
            null,
            &size,
            &device_id,
        );

        if (status != 0) {
            std.log.err("Failed to get default input device, status: {d}", .{status});
            return CoreAudioError.DeviceNotFound;
        }

        return device_id;
    }

    /// Get the default output device ID (for monitoring)
    fn getDefaultOutputDevice() !c.AudioDeviceID {
        var device_id: c.AudioDeviceID = 0;
        var size = @sizeOf(c.AudioDeviceID);
        const prop_addr = AudioObjectPropertyAddress{
            .mSelector = kAudioHardwarePropertyDefaultOutputDevice,
            .mScope = kAudioObjectPropertyScopeGlobal,
            .mElement = 0,
        };

        const status = c.AudioObjectGetPropertyData(
            c.kAudioObjectSystemObject,
            &prop_addr,
            0,
            null,
            &size,
            &device_id,
        );

        if (status != 0) {
            std.log.err("Failed to get default output device, status: {d}", .{status});
            return CoreAudioError.DeviceNotFound;
        }

        return device_id;
    }

    /// Create AudioComponentDescription for HAL output
    fn getHALOutputDesc() c.AudioComponentDescription {
        return .{
            .componentType = kAudioUnitType_Output,
            .componentSubType = kAudioUnitSubType_HALOutput,
            .componentManufacturer = kAudioUnitManufacturer_Apple,
            .componentFlags = 0,
            .componentFlagsMask = 0,
        };
    }

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource) CoreAudioError!Self {
        const format = AudioFormat{ .sample_rate = sample_rate };

        // macOS doesn't easily support loopback/mode monitoring without extra permissions
        // Fall back to microphone for monitor source
        const effective_source = switch (source) {
            .microphone => .microphone,
            .monitor => {
                std.log.warn("Monitor mode not supported on macOS, using microphone instead", .{});
                break : .microphone;
            },
        };

        // Find the default input device
        const device_id = try getDefaultInputDevice();

        // Create AudioComponentDescription
        const desc = getHALOutputDesc();
        const component = c.AudioComponentFindNext(null, &desc);
        if (component == null) {
            std.log.err("Failed to find HAL output component", .{});
            return CoreAudioError.DeviceNotFound;
        }

        // Create AudioUnit instance
        var audio_unit: c.AudioUnit = undefined;
        var status = c.AudioComponentInstanceNew(component, &audio_unit);
        if (status != 0) {
            std.log.err("Failed to create audio unit, status: {d}", .{status});
            return CoreAudioError.InitializeFailed;
        }

        // Enable input on the audio unit
        var enable: u32 = 1;
        var prop_addr = AudioObjectPropertyAddress{
            .mSelector = kAudioUnitProperty_EnableIO,
            .mScope = kAudioObjectPropertyScopeInput,
            .mElement = kAudioOutputUnitRange_Input,
        };
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_EnableIO,
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &enable,
            @sizeOf(u32),
        );

        if (status != 0) {
            std.log.err("Failed to enable input, status: {d}", .{status});
            c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.InitializeFailed;
        }

        // Disable output on the audio unit (we only want input)
        enable = 0;
        prop_addr.mScope = kAudioObjectPropertyScopeOutput;
        prop_addr.mElement = kAudioOutputUnitRange_Output;
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_EnableIO,
            kAudioObjectPropertyScopeOutput,
            kAudioOutputUnitRange_Output,
            &enable,
            @sizeOf(u32),
        );

        if (status != 0) {
            std.log.warn("Failed to disable output (non-fatal), status: {d}", .{status});
        }

        // Set the audio format
        const stream_format = format.toAudioStreamBasicDescription();
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_StreamFormat,
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &stream_format,
            @sizeOf(c.AudioStreamBasicDescription),
        );

        if (status != 0) {
            std.log.err("Failed to set stream format, status: {d}", .{status});
            c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.FormatMismatch;
        }

        // Set the current device
        status = c.AudioUnitSetProperty(
            audio_unit,
            0x6476646c, // kAudioOutputUnitProperty_CurrentDevice = 'dvdl'
            kAudioObjectPropertyScopeGlobal,
            0,
            &device_id,
            @sizeOf(c.AudioDeviceID),
        );

        if (status != 0) {
            std.log.err("Failed to set current device, status: {d}", .{status});
            c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.DeviceNotFound;
        }

        // Set buffer size (50ms = 800 frames at 16kHz)
        const buffer_frames = (sample_rate * 50) / 1000;
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioDevicePropertyBufferFrameSize,
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &buffer_frames,
            @sizeOf(u32),
        );

        if (status != 0) {
            std.log.warn("Failed to set buffer size (non-fatal), status: {d}", .{status});
        }

        // Allocate buffer for audio data
        const buffer_size = buffer_frames * @sizeOf(i16);
        const buffer = try allocator.alloc(i16, buffer_frames);

        return Self{
            .audio_unit = audio_unit,
            .format = format,
            .source = effective_source,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .buffer = buffer,
            .buffer_size = buffer_size,
        };
    }

    /// Read audio samples using AudioUnitRender
    pub fn read(self: *Self, buffer: []i16) CoreAudioError![]i16 {
        if (!self.running.load(.acquire)) {
            return CoreAudioError.ReadFailed;
        }

        // Create AudioBufferList for the render
        var audio_buffer: c.AudioBuffer = .{
            .mNumberChannels = self.format.channels,
            .mDataByteSize = @intCast(buffer.len * @sizeOf(i16)),
            .mData = @ptrCast(buffer.ptr),
        };

        var audio_buffer_list: c.AudioBufferList = .{
            .mNumberBuffers = 1,
            .mBuffers = [_]c.AudioBuffer{audio_buffer} ** 1,
        };

        // Render the audio
        var io_action_flags: u32 = 0;
        var in_time_stamp: c.AudioTimeStamp = undefined;
        in_time_stamp.mFlags = 0;
        var in_bus_number: u32 = kAudioOutputUnitRange_Input;

        const status = c.AudioUnitRender(
            self.audio_unit,
            &io_action_flags,
            &in_time_stamp,
            in_bus_number,
            @intCast(buffer.len),
            &audio_buffer_list,
        );

        if (status != 0) {
            std.log.err("AudioUnitRender failed, status: {d}", .{status});
            return CoreAudioError.ReadFailed;
        }

        return buffer;
    }

    /// Start capture
    pub fn start(self: *Self) !void {
        const status = c.AudioOutputUnitStart(self.audio_unit);
        if (status != 0) {
            std.log.err("Failed to start audio unit, status: {d}", .{status});
            return CoreAudioError.StartFailed;
        }
        self.running.store(true, .release);
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        self.running.store(false, .release);
        _ = c.AudioOutputUnitStop(self.audio_unit);
    }

    /// Check if still running
    pub fn isRunning(self: *Self) bool {
        return self.running.load(.acquire);
    }

    /// Get the sample rate
    pub fn getSampleRate(self: *Self) u32 {
        return self.format.sample_rate;
    }

    /// Get the audio source type
    pub fn getSource(self: *Self) AudioSource {
        return self.source;
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        self.running.store(false, .release);
        _ = c.AudioOutputUnitStop(self.audio_unit);
        _ = c.AudioUnitUninitialize(self.audio_unit);
        _ = c.AudioComponentInstanceDispose(self.audio_unit);
        self.allocator.free(self.buffer);
    }
};

// Backwards compatibility alias
pub const MicCapture = AudioCapture;
