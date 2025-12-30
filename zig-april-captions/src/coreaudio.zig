//! CoreAudio audio capture for macOS
//! Uses AudioUnit framework for native macOS audio capture
//! Reference: Apple CoreAudio and AudioUnit documentation

const std = @import("std");
const builtin = @import("builtin");

const is_macos = builtin.os.tag == .macos;

// Only define macOS types when actually on macOS
const c = if (is_macos) @cImport({
    @cInclude("CoreFoundation/CoreFoundation.h");
    @cInclude("AudioUnit/AudioUnit.h");
    @cInclude("AudioToolbox/AudioServices.h");
}) else struct {};

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
};

// CoreAudio constants (only defined on macOS)
const kAudioUnitType_Output = if (is_macos) @as(u32, 0x6f75746c) else 0;
const kAudioUnitSubType_HALOutput = if (is_macos) @as(u32, 0x68616c6f) else 0;
const kAudioUnitManufacturer_Apple = if (is_macos) @as(u32, 0x6170706c) else 0;

const kAudioObjectPropertyScopeInput = if (is_macos) @as(u32, 0x01) else 0;
const kAudioObjectPropertyScopeOutput = if (is_macos) @as(u32, 0x02) else 0;
const kAudioObjectPropertyScopeGlobal = if (is_macos) @as(u32, 0x00) else 0;

const kAudioHardwarePropertyDefaultInputDevice = if (is_macos) @as(u32, 0x6473696c) else 0;
const kAudioObjectSystemObject = if (is_macos) @as(u32, 1) else 0;

const kAudioFormatLinearPCM = if (is_macos) @as(u32, 0x6c70636d) else 0;
const kLinearPCMFormatFlagIsSignedInteger = if (is_macos) @as(u32, 1 << 1) else 0;
const kLinearPCMFormatFlagIsPacked = if (is_macos) @as(u32, 1 << 3) else 0;
const kAudioFormatFlagsNativeEndian = if (is_macos) @as(u32, 0 << 2) else 0;

const kAudioUnitProperty_StreamFormat = if (is_macos) @as(u32, 10) else 0;
const kAudioUnitProperty_EnableIO = if (is_macos) @as(u32, 5) else 0;

const kAudioOutputUnitRange_Input = if (is_macos) @as(u32, 1) else 0;
const kAudioOutputUnitRange_Output = if (is_macos) @as(u32, 0) else 0;

// Type aliases (only valid on macOS)
const AudioDeviceID = if (is_macos) c.AudioDeviceID else u32;
const AudioUnit = if (is_macos) c.AudioUnit else opaque {};
const AudioComponentDescription = if (is_macos) c.AudioComponentDescription else extern struct {};
const AudioComponent = if (is_macos) ?*anyopaque else *anyopaque;
const AudioStreamBasicDescription = if (is_macos) c.AudioStreamBasicDescription else extern struct {};
const AudioBuffer = if (is_macos) c.AudioBuffer else extern struct {};
const AudioBufferList = if (is_macos) c.AudioBufferList else extern struct {};
const AudioTimeStamp = if (is_macos) c.AudioTimeStamp else extern struct {};

pub const AudioCapture = struct {
    audio_unit: AudioUnit,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    buffer: []i16,
    buffer_size: usize,

    const Self = @This();

    /// Get the default input device ID
    fn getDefaultInputDevice() !AudioDeviceID {
        if (!is_macos) return error.DeviceNotFound;

        var device_id: AudioDeviceID = 0;
        var size: u32 = @sizeOf(AudioDeviceID);

        const prop_addr = extern struct {
            mSelector: u32,
            mScope: u32,
            mElement: u32,
        }{
            .mSelector = kAudioHardwarePropertyDefaultInputDevice,
            .mScope = kAudioObjectPropertyScopeGlobal,
            .mElement = 0,
        };

        const status = c.AudioObjectGetPropertyData(
            c.kAudioObjectSystemObject,
            @ptrCast(&prop_addr),
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

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource) CoreAudioError!Self {
        if (!is_macos) {
            @compileError("CoreAudio is only available on macOS");
        }

        const format = AudioFormat{ .sample_rate = sample_rate };

        // macOS doesn't easily support loopback/mode monitoring without extra permissions
        // Fall back to microphone for monitor source
        const effective_source = switch (source) {
            .microphone => AudioSource.microphone,
            .monitor => AudioSource.microphone, // Fallback
        };

        _ = effective_source;

        // Find the default input device
        const device_id = try getDefaultInputDevice();

        // Create AudioComponentDescription
        const desc = AudioComponentDescription{
            .componentType = kAudioUnitType_Output,
            .componentSubType = kAudioUnitSubType_HALOutput,
            .componentManufacturer = kAudioUnitManufacturer_Apple,
            .componentFlags = 0,
            .componentFlagsMask = 0,
        };

        const component = c.AudioComponentFindNext(null, &desc);
        if (component == null) {
            std.log.err("Failed to find HAL output component", .{});
            return CoreAudioError.DeviceNotFound;
        }

        // Create AudioUnit instance
        var audio_unit: AudioUnit = undefined;
        var status = c.AudioComponentInstanceNew(component, &audio_unit);
        if (status != 0) {
            std.log.err("Failed to create audio unit, status: {d}", .{status});
            return CoreAudioError.InitializeFailed;
        }

        // Enable input on the audio unit
        var enable: u32 = 1;

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
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.InitializeFailed;
        }

        // Set the audio format
        const stream_format = extern struct {
            mSampleRate: f64,
            mFormatID: u32,
            mFormatFlags: u32,
            mBytesPerPacket: u32,
            mFramesPerPacket: u32,
            mBytesPerFrame: u32,
            mChannelsPerFrame: u32,
            mBitsPerChannel: u32,
            mReserved: u32,
        }{
            .mSampleRate = @floatFromInt(format.sample_rate),
            .mFormatID = kAudioFormatLinearPCM,
            .mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked | kAudioFormatFlagsNativeEndian,
            .mBytesPerPacket = format.channels * format.bits_per_sample / 8,
            .mFramesPerPacket = 1,
            .mBytesPerFrame = format.channels * format.bits_per_sample / 8,
            .mChannelsPerFrame = format.channels,
            .mBitsPerChannel = format.bits_per_sample,
            .mReserved = 0,
        };

        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_StreamFormat,
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &stream_format,
            @sizeOf(extern struct { mSampleRate: f64, mFormatID: u32, mFormatFlags: u32, mBytesPerPacket: u32, mFramesPerPacket: u32, mBytesPerFrame: u32, mChannelsPerFrame: u32, mBitsPerChannel: u32, mReserved: u32 }),
        );

        if (status != 0) {
            std.log.err("Failed to set stream format, status: {d}", .{status});
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.FormatMismatch;
        }

        // Set the current device
        status = c.AudioUnitSetProperty(
            audio_unit,
            0x6476646c, // kAudioOutputUnitProperty_CurrentDevice = 'dvdl'
            kAudioObjectPropertyScopeGlobal,
            0,
            &device_id,
            @sizeOf(AudioDeviceID),
        );

        if (status != 0) {
            std.log.err("Failed to set current device, status: {d}", .{status});
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.DeviceNotFound;
        }

        // Set buffer size (50ms = 800 frames at 16kHz)
        const buffer_frames = (sample_rate * 50) / 1000;
        status = c.AudioUnitSetProperty(
            audio_unit,
            0x6273697a, // kAudioDevicePropertyBufferFrameSize = 'bsiz'
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &buffer_frames,
            @sizeOf(u32),
        );

        if (status != 0) {
            std.log.warn("Failed to set buffer size (non-fatal), status: {d}", .{status});
        }

        // Allocate buffer for audio data
        const buffer = try allocator.alloc(i16, buffer_frames);

        return Self{
            .audio_unit = audio_unit,
            .format = format,
            .source = .microphone,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .buffer = buffer,
            .buffer_size = buffer_frames * @sizeOf(i16),
        };
    }

    pub fn read(self: *Self, buffer: []i16) CoreAudioError![]i16 {
        _ = self;
        _ = buffer;
        if (!is_macos) {
            return CoreAudioError.ReadFailed;
        }
        return CoreAudioError.ReadFailed;
    }

    pub fn start(self: *Self) !void {
        _ = self;
        if (!is_macos) {
            return CoreAudioError.StartFailed;
        }
        return CoreAudioError.StartFailed;
    }

    pub fn stop(self: *Self) void {
        _ = self;
    }

    pub fn isRunning(self: *Self) bool {
        _ = self;
        return false;
    }

    pub fn getSampleRate(self: *Self) u32 {
        _ = self;
        return 16000;
    }

    pub fn getSource(self: *Self) AudioSource {
        _ = self;
        return AudioSource.microphone;
    }

    pub fn deinit(self: *Self) void {
        _ = self;
    }
};

// Backwards compatibility alias
pub const MicCapture = AudioCapture;
