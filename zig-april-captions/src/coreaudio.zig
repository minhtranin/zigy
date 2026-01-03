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
const kAudioUnitType_Output = if (is_macos) @as(u32, 0x61756f75) else 0; // 'auou'
const kAudioUnitSubType_HALOutput = if (is_macos) @as(u32, 0x6168616c) else 0; // 'ahal'
const kAudioUnitManufacturer_Apple = if (is_macos) @as(u32, 0x6170706c) else 0;

// AudioObjectPropertyScope constants (FourCC) - for AudioObject API
const kAudioObjectPropertyScopeInput = if (is_macos) @as(u32, 0x696e7074) else 0; // 'inpt'
const kAudioObjectPropertyScopeOutput = if (is_macos) @as(u32, 0x6f757470) else 0; // 'outp'
const kAudioObjectPropertyScopeGlobal = if (is_macos) @as(u32, 0x676c6f62) else 0; // 'glob'

// AudioUnitScope constants (simple enum values) - for AudioUnit API
// CRITICAL: These are NOT FourCC values! They are simple integers.
// Using the wrong scope type causes -10877 (kAudioUnitErr_InvalidElement)
const kAudioUnitScope_Global = if (is_macos) @as(u32, 0) else 0;
const kAudioUnitScope_Input = if (is_macos) @as(u32, 1) else 0;
const kAudioUnitScope_Output = if (is_macos) @as(u32, 2) else 0;

const kAudioHardwarePropertyDefaultInputDevice = if (is_macos) @as(u32, 0x64496e20) else 0; // 'dIn '
const kAudioObjectSystemObject = if (is_macos) @as(u32, 1) else 0;
const kAudioObjectPropertyElementMain = if (is_macos) @as(u32, 0) else 0;

const kAudioFormatLinearPCM = if (is_macos) @as(u32, 0x6c70636d) else 0;
const kLinearPCMFormatFlagIsSignedInteger = if (is_macos) @as(u32, 1 << 1) else 0;
const kLinearPCMFormatFlagIsPacked = if (is_macos) @as(u32, 1 << 3) else 0;
const kAudioFormatFlagsNativeEndian = if (is_macos) @as(u32, 0 << 2) else 0;

const kAudioUnitProperty_StreamFormat = if (is_macos) @as(u32, 10) else 0;
const kAudioOutputUnitProperty_EnableIO = if (is_macos) @as(u32, 2003) else 0;
const kAudioOutputUnitProperty_SetInputCallback = if (is_macos) @as(u32, 2004) else 0;

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
    running: *const std.atomic.Value(bool), // Pointer to AudioCapture's running flag
};

pub const AudioCapture = struct {
    audio_unit: AudioUnit,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    ring_buffer: *RingBuffer,
    capture_context: *CaptureContext, // Pointer to context used by callback
    verbose: bool,

    const Self = @This();

    /// Get the default input device ID
    fn getDefaultInputDevice(self: *Self) !AudioDeviceID {
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
            .mElement = kAudioObjectPropertyElementMain,
        };

        if (self.verbose) {
            std.log.debug("Querying default input device...", .{});
        }

        const status = c.AudioObjectGetPropertyData(
            kAudioObjectSystemObject,
            @ptrCast(&prop_addr),
            0,
            null,
            &size,
            &device_id,
        );

        if (status != 0) {
            if (self.verbose) {
                std.log.err("Failed to get default input device (status: {d})", .{status});
                std.log.err("Trying to enumerate all audio devices...", .{});
            }
            // Fallback: try to enumerate all devices
            return self.findAnyInputDevice();
        }

        if (device_id == 0) {
            if (self.verbose) {
                std.log.err("Default input device ID is 0, trying enumeration...", .{});
            }
            return self.findAnyInputDevice();
        }

        if (self.verbose) {
            std.log.debug("Found default input device: {d}", .{device_id});
        }
        return device_id;
    }

    /// Fallback: enumerate all audio devices and find first input device
    fn findAnyInputDevice(self: *Self) !AudioDeviceID {
        if (!is_macos) return error.DeviceNotFound;

        // First, get all devices
        var devices_size: u32 = 0;

        const get_size_addr = extern struct {
            mSelector: u32,
            mScope: u32,
            mElement: u32,
        }{
            .mSelector = 0x64657623, // kAudioHardwarePropertyDevices = 'dev#'
            .mScope = kAudioObjectPropertyScopeGlobal,
            .mElement = kAudioObjectPropertyElementMain,
        };

        // Get size of devices array
        var size_status = c.AudioObjectGetPropertyDataSize(
            kAudioObjectSystemObject,
            @ptrCast(&get_size_addr),
            0,
            null,
            &devices_size,
        );

        if (size_status != 0) {
            if (self.verbose) {
                std.log.err("Failed to get devices array size (status: {d})", .{size_status});
            }
            return CoreAudioError.DeviceNotFound;
        }

        const device_count = devices_size / @sizeOf(AudioDeviceID);
        if (self.verbose) {
            std.log.debug("Found {d} audio devices, checking for input...", .{device_count});
        }

        if (device_count == 0) {
            if (self.verbose) {
                std.log.err("No audio devices found on system", .{});
            }
            return CoreAudioError.DeviceNotFound;
        }

        // Allocate array for devices
        const devices = try std.heap.page_allocator.alloc(AudioDeviceID, device_count);
        defer std.heap.page_allocator.free(devices);

        devices_size = @intCast(devices_size);

        // Get all devices
        size_status = c.AudioObjectGetPropertyData(
            kAudioObjectSystemObject,
            @ptrCast(&get_size_addr),
            0,
            null,
            &devices_size,
            devices.ptr,
        );

        if (size_status != 0) {
            if (self.verbose) {
                std.log.err("Failed to get devices array (status: {d})", .{size_status});
            }
            return CoreAudioError.DeviceNotFound;
        }

        // Check each device for input capability
        for (devices[0..device_count]) |dev_id| {
            if (try self.deviceHasInput(dev_id)) {
                if (self.verbose) {
                    std.log.debug("Found input device: {d}", .{dev_id});
                }
                return dev_id;
            }
        }

        if (self.verbose) {
            std.log.err("No input-capable audio device found", .{});
            std.log.err("Possible causes:", .{});
            std.log.err("  1. No microphone connected", .{});
            std.log.err("  2. Microphone permission denied (System Settings → Privacy & Security → Microphone)", .{});
        }
        return CoreAudioError.DeviceNotFound;
    }

    /// Check if a device has input capability
    fn deviceHasInput(self: *Self, device_id: AudioDeviceID) !bool {
        _ = self; // Keep self parameter for consistency with other instance methods

        // Use kAudioDevicePropertyStreams with input scope to check if device has input streams
        // If the property data size is > 0, the device has input capability
        const prop_addr = extern struct {
            mSelector: u32,
            mScope: u32,
            mElement: u32,
        }{
            .mSelector = 0x73746d23, // kAudioDevicePropertyStreams = 'stm#'
            .mScope = kAudioObjectPropertyScopeInput,
            .mElement = kAudioObjectPropertyElementMain,
        };

        var size: u32 = 0;

        // Get the size of the streams array for input scope
        const status = c.AudioObjectGetPropertyDataSize(
            device_id,
            @ptrCast(&prop_addr),
            0,
            null,
            &size,
        );

        // If query succeeds and size > 0, device has input streams
        return status == 0 and size > 0;
    }

    /// Audio render callback - called by CoreAudio when audio data is available
    ///
    /// WARNING: This callback relies on undocumented CoreAudio behavior.
    /// For HALOutput input callbacks, Apple's documentation states that input
    /// data must be pulled using AudioUnitRender(), not read from ioData.
    /// However, on many macOS versions/drivers, Apple internally fills ioData
    /// anyway. This implementation reads from ioData for simplicity, but may
    /// break on:
    /// - Future macOS versions
    /// - External USB/Bluetooth devices
    /// - Aggregate devices
    ///
    /// TODO: Implement proper AudioUnitRender pull model for production use.
    fn audioCallback(
        inRefCon: ?*anyopaque,
        ioActionFlags: [*c]c.AudioUnitRenderActionFlags,
        inTimeStamp: [*c]const c.AudioTimeStamp,
        inBusNumber: c.UInt32,
        inNumberFrames: c.UInt32,
        ioData: [*c]c.AudioBufferList,
    ) callconv(.C) c.OSStatus {
        _ = ioActionFlags;
        _ = inTimeStamp;
        _ = inBusNumber;

        const context = @as(*CaptureContext, @ptrCast(@alignCast(inRefCon)));

        if (!context.running.load(.acquire)) {
            return c.noErr;
        }

        const buffer_list = ioData[0];
        if (buffer_list.mNumberBuffers < 1) return c.noErr;

        const buffer = &buffer_list.mBuffers[0];
        const samples = @as([*]i16, @ptrCast(@alignCast(buffer.mData)))[0..inNumberFrames];

        // Write samples to ring buffer
        context.ring_buffer.write(samples);

        return c.noErr;
    }

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource, verbose: bool) CoreAudioError!Self {
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

        // Create a temporary self to call instance methods for device lookup
        // (we'll create the real one later with all fields)
        var temp_self = Self{
            .audio_unit = undefined,
            .format = format,
            .source = .microphone,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .ring_buffer = undefined,
            .capture_context = undefined,
            .verbose = verbose,
        };

        // Find the default input device with retry logic
        // On macOS, after the permission dialog is accepted, the system may need
        // a moment to update the audio device list. We retry with increasing delays
        // to handle this race condition (similar to how Apple's LiveCaptions works).
        const max_retries = 10;
        const retry_delays_ms = [_]u64{ 100, 200, 300, 500, 500, 1000, 1000, 1000, 2000, 2000 };

        var device_id: AudioDeviceID = 0;
        var last_error: CoreAudioError = CoreAudioError.DeviceNotFound;

        for (0..max_retries) |attempt| {
            device_id = temp_self.getDefaultInputDevice() catch |err| {
                last_error = err;
                if (verbose) {
                    std.log.warn("Device lookup attempt {d}/{d} failed, retrying in {d}ms...", .{ attempt + 1, max_retries, retry_delays_ms[attempt] });
                    std.log.warn("  This is normal after accepting microphone permission - waiting for system to update device list", .{});
                }
                // Sleep before retry
                std.time.sleep(retry_delays_ms[attempt] * std.time.ns_per_ms);
                continue;
            };
            // Success!
            if (verbose and attempt > 0) {
                std.log.info("Device found after {d} retries", .{attempt});
            }
            break;
        } else {
            // All retries exhausted
            std.log.err("Failed to find audio device after {d} retries", .{max_retries});
            std.log.err("Please ensure:", .{});
            std.log.err("  1. Microphone permission is granted in System Settings > Privacy & Security > Microphone", .{});
            std.log.err("  2. A microphone is connected to your Mac", .{});
            std.log.err("  3. Try restarting the application after granting permission", .{});
            return last_error;
        }

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

        // CRITICAL: For HAL Output Audio Unit on macOS:
        // 1. DISABLE output (element 0) - we don't need playback
        // 2. ENABLE input (element 1) - we want microphone capture
        //
        // NOTE: Must use kAudioUnitScope_* (simple enum 0,1,2) NOT
        // kAudioObjectPropertyScope* (FourCC values like 'inpt').
        // Using wrong scope type causes -10877 (kAudioUnitErr_InvalidElement).

        // Step 1: DISABLE OUTPUT (element 0) - we only want input
        var disable: u32 = 0;
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Output, // scope = 2 (NOT 'outp' FourCC!)
            kAudioOutputUnitRange_Output, // element = 0
            &disable,
            @sizeOf(u32),
        );

        if (status != 0) {
            // Non-fatal: some audio units may not support disabling output
            if (verbose) {
                std.log.warn("Could not disable output (non-fatal), status: {d}", .{status});
            }
        }

        // Step 2: ENABLE INPUT (element 1) - this is what we need for microphone
        var enable: u32 = 1;
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioOutputUnitProperty_EnableIO,
            kAudioUnitScope_Input, // scope = 1 (NOT 'inpt' FourCC!)
            kAudioOutputUnitRange_Input, // element = 1
            &enable,
            @sizeOf(u32),
        );

        if (status != 0) {
            std.log.err("Failed to enable input, status: {d}", .{status});
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.InitializeFailed;
        }

        // Step 3: Set the current device BEFORE setting format
        // The AudioUnit needs to know which device we're using to validate the format
        status = c.AudioUnitSetProperty(
            audio_unit,
            2000, // kAudioOutputUnitProperty_CurrentDevice
            kAudioUnitScope_Global, // scope = 0 (NOT 'glob' FourCC!)
            0, // element = 0
            &device_id,
            @sizeOf(AudioDeviceID),
        );

        if (status != 0) {
            std.log.err("Failed to set current device, status: {d}", .{status});
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.DeviceNotFound;
        }

        // Step 4: Set the audio format (AFTER device is set)
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

        // Set format on the OUTPUT scope of the INPUT element
        // (the data flowing out of the input element to our code)
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Output, // scope = 2 (output side of input element)
            kAudioOutputUnitRange_Input, // element = 1
            &stream_format,
            @sizeOf(@TypeOf(stream_format)),
        );

        if (status != 0) {
            std.log.err("Failed to set stream format, status: {d}", .{status});
            _ = c.AudioComponentInstanceDispose(audio_unit);
            return CoreAudioError.FormatMismatch;
        }

        // Set buffer size (50ms = 800 frames at 16kHz)
        // Note: This is a device property, but set via AudioUnit on global scope
        const buffer_frames = (sample_rate * 50) / 1000;
        status = c.AudioUnitSetProperty(
            audio_unit,
            0x6673697a, // kAudioDevicePropertyBufferFrameSize = 'fsiz'
            kAudioUnitScope_Global, // scope = 0
            0, // element = 0
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

        // Create capture context (owned by AudioCapture)
        // running will be set after creating AudioCapture
        const capture_context_ptr = try allocator.create(CaptureContext);
        capture_context_ptr.* = CaptureContext{
            .ring_buffer = ring_buffer,
            .running = undefined, // Will set after creating AudioCapture
        };

        callback_struct.inputProcRefCon = capture_context_ptr;

        // Set the input callback (global scope, element 0 for HAL Output AU)
        status = c.AudioUnitSetProperty(
            audio_unit,
            kAudioOutputUnitProperty_SetInputCallback,
            kAudioUnitScope_Global, // scope = 0 (callbacks are global)
            0, // element = 0
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

        // Create AudioCapture with running flag
        const running = std.atomic.Value(bool).init(false);

        // Now set the running pointer in capture_context
        capture_context_ptr.running = &running;

        return Self{
            .audio_unit = audio_unit,
            .format = format,
            .source = .microphone,
            .running = running,
            .allocator = allocator,
            .ring_buffer = ring_buffer,
            .capture_context = capture_context_ptr,
            .verbose = verbose,
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
        self.allocator.destroy(self.capture_context);
    }
};

// Backwards compatibility alias
pub const MicCapture = AudioCapture;
