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
    OutOfMemory,
    Terminated,
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
const kAudioUnitProperty_SetRenderCallback = if (is_macos) @as(u32, 6) else 0;

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
const AURenderCallbackStruct = if (is_macos) c.AURenderCallbackStruct else extern struct {};

/// Thread-safe ring buffer for audio data
const RingBuffer = struct {
    data: []i16,
    write_pos: usize,
    read_pos: usize,
    capacity: usize,
    mutex: std.Thread.Mutex,
    condition: std.Thread.Condition,

    const Self = @This();

    fn init(allocator: std.mem.Allocator, capacity: usize) !Self {
        const data = try allocator.alloc(i16, capacity);
        return Self{
            .data = data,
            .write_pos = 0,
            .read_pos = 0,
            .capacity = capacity,
            .mutex = .{},
            .condition = .{},
        };
    }

    fn deinit(self: *Self, allocator: std.mem.Allocator) void {
        allocator.free(self.data);
    }

    fn write(self: *Self, samples: []const i16) void {
        self.mutex.lock();
        defer self.mutex.unlock();

        for (samples) |sample| {
            self.data[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.capacity;

            // Advance read_pos if buffer is full (drop old data)
            if (self.write_pos == self.read_pos) {
                self.read_pos = (self.read_pos + 1) % self.capacity;
            }
        }

        self.condition.signal();
    }

    fn read(self: *Self, buffer: []i16) usize {
        self.mutex.lock();
        defer self.mutex.unlock();

        var count: usize = 0;
        while (count < buffer.len and self.read_pos != self.write_pos) : (count += 1) {
            buffer[count] = self.data[self.read_pos];
            self.read_pos = (self.read_pos + 1) % self.capacity;
        }

        return count;
    }

    fn available(self: *Self) usize {
        self.mutex.lock();
        defer self.mutex.unlock();

        if (self.write_pos >= self.read_pos) {
            return self.write_pos - self.read_pos;
        } else {
            return self.capacity - self.read_pos + self.write_pos;
        }
    }
};

// Global context for render callback
const CaptureContext = struct {
    ring_buffer: *RingBuffer,
    running: *std.atomic.Value(bool),
};

pub const AudioCapture = struct {
    audio_unit: AudioUnit,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    ring_buffer: *RingBuffer,
    capture_context: CaptureContext,

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
            kAudioObjectSystemObject,
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

    /// Audio render callback - called by CoreAudio when audio data is available
    fn audioCallback(
        inRefCon: ?*anyopaque,
        ioActionFlags: ?*anyopaque,
        inTimeStamp: [*c]const AudioTimeStamp,
        inBusNumber: u32,
        inNumberFrames: u32,
        ioData: [*c]AudioBufferList,
    ) callconv(.C) c_int {
        _ = ioActionFlags;
        _ = inTimeStamp;
        _ = inBusNumber;

        const context = @as(*CaptureContext, @ptrCast(@alignCast(inRefCon)));

        if (!context.running.load(.acquire)) {
            return 0;
        }

        const buffer_list = ioData[0];
        if (buffer_list.mNumberBuffers < 1) return 0;

        const buffer = &buffer_list.mBuffers[0];
        const samples = @as([*]i16, @ptrCast(@alignCast(buffer.mData)))[0..inNumberFrames];

        // Write samples to ring buffer
        context.ring_buffer.write(samples);

        return 0;
    }

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource) CoreAudioError!Self {
        if (!is_macos) {
            @compileError("CoreAudio is only available on macOS");
        }

        const format = AudioFormat{ .sample_rate = sample_rate };

        // macOS doesn't easily support loopback/monitoring without extra permissions
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

        // Disable output (we only want input)
        enable = 0;
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
            @sizeOf(@TypeOf(stream_format)),
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

        // Create ring buffer (capacity = 2 seconds of audio)
        const ring_buffer_capacity = sample_rate * 2;
        const ring_buffer = try allocator.create(RingBuffer);
        ring_buffer.* = try RingBuffer.init(allocator, ring_buffer_capacity);

        // Set up render callback
        var callback_struct = AURenderCallbackStruct{
            .inputProc = audioCallback,
            .inputProcRefCon = undefined, // Will set after creating capture_context
        };

        // Create capture context (will be owned by AudioCapture)
        // We need to set up the structure before we can get the pointer
        const capture_context_ptr = try allocator.create(CaptureContext);
        capture_context_ptr.* = CaptureContext{
            .ring_buffer = ring_buffer,
            .running = undefined, // Will set after creating AudioCapture
        };

        callback_struct.inputProcRefCon = capture_context_ptr;

        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_SetRenderCallback,
            kAudioObjectPropertyScopeInput,
            kAudioOutputUnitRange_Input,
            &callback_struct,
            @sizeOf(AURenderCallbackStruct),
        );

        if (status != 0) {
            std.log.err("Failed to set render callback, status: {d}", .{status});
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            allocator.destroy(capture_context_ptr);
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.InitializeFailed;
        }

        // Initialize the AudioUnit
        status = c.AudioUnitInitialize(audio_unit);
        if (status != 0) {
            std.log.err("Failed to initialize audio unit, status: {d}", .{status});
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            allocator.destroy(capture_context_ptr);
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.InitializeFailed;
        }

        return Self{
            .audio_unit = audio_unit,
            .format = format,
            .source = .microphone,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .ring_buffer = ring_buffer,
            .capture_context = .{
                .ring_buffer = ring_buffer,
                .running = undefined, // Will set below
            },
        };
    }

    pub fn read(self: *Self, buffer: []i16) CoreAudioError![]i16 {
        const count = self.ring_buffer.read(buffer);

        if (count == 0) {
            // No data available yet
            if (!self.running.load(.acquire)) {
                return CoreAudioError.Terminated;
            }
            return buffer[0..0];
        }

        return buffer[0..count];
    }

    pub fn start(self: *Self) !void {
        // Update capture context reference
        self.capture_context.running = &self.running;

        const status = c.AudioOutputUnitStart(self.audio_unit);
        if (status != 0) {
            std.log.err("Failed to start audio unit, status: {d}", .{status});
            return CoreAudioError.StartFailed;
        }

        self.running.store(true, .release);
    }

    pub fn stop(self: *Self) void {
        self.running.store(false, .release);

        const status = c.AudioOutputUnitStop(self.audio_unit);
        if (status != 0) {
            std.log.warn("Failed to stop audio unit cleanly, status: {d}", .{status});
        }
    }

    pub fn isRunning(self: *Self) bool {
        return self.running.load(.acquire);
    }

    pub fn getSampleRate(self: *Self) u32 {
        return self.format.sample_rate;
    }

    pub fn getSource(self: *Self) AudioSource {
        return self.source;
    }

    pub fn deinit(self: *Self) void {
        self.stop();

        _ = c.AudioUnitUninitialize(self.audio_unit);
        _ = c.AudioComponentInstanceDispose(self.audio_unit);

        self.ring_buffer.deinit(self.allocator);
        self.allocator.destroy(self.ring_buffer);
        self.allocator.destroy(&self.capture_context);
    }
};

// Backwards compatibility alias
pub const MicCapture = AudioCapture;
