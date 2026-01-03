//! miniaudio-based audio capture
//! Cross-platform audio capture using the miniaudio library
//! Replaces platform-specific implementations (CoreAudio, PulseAudio, WASAPI)

const std = @import("std");
const builtin = @import("builtin");

// Import miniaudio C API
const c = @cImport({
    @cInclude("miniaudio.h");
});

pub const AudioError = error{
    DeviceNotFound,
    FormatMismatch,
    InitializeFailed,
    StartFailed,
    ReadFailed,
    BufferError,
    OutOfMemory,
    Terminated,
};

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio output (loopback)
};

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
};

/// Capture context passed to miniaudio callback
const CaptureContext = struct {
    ring_buffer: *RingBuffer,
    running: std.atomic.Value(bool),  // Store directly, not pointer!
    channels: u32,
    verbose: bool,
};

/// miniaudio data callback - called when audio data is available
fn dataCallback(
    device: [*c]c.ma_device,
    output: ?*anyopaque,
    input: ?*const anyopaque,
    frame_count: c.ma_uint32,
) callconv(.C) void {
    _ = output; // We don't use output for capture

    const ctx = @as(*CaptureContext, @ptrCast(@alignCast(device.*.pUserData)));

    if (!ctx.running.load(.acquire)) {
        return;
    }

    if (input == null) {
        return;
    }

    // miniaudio gives us interleaved samples in the format we requested (s16)
    const input_ptr = @as([*]const i16, @ptrCast(@alignCast(input)));
    const total_samples = frame_count * ctx.channels;

    // If stereo, convert to mono by averaging channels
    if (ctx.channels == 2) {
        var mono_samples: [4096]i16 = undefined;
        const mono_count = @min(frame_count, mono_samples.len);

        var i: usize = 0;
        while (i < mono_count) : (i += 1) {
            const left = @as(i32, input_ptr[i * 2]);
            const right = @as(i32, input_ptr[i * 2 + 1]);
            mono_samples[i] = @intCast(@divTrunc(left + right, 2));
        }

        ctx.ring_buffer.write(mono_samples[0..mono_count]);
    } else {
        // Already mono, just write directly
        ctx.ring_buffer.write(input_ptr[0..total_samples]);
    }
}

pub const AudioCapture = struct {
    device: c.ma_device,
    device_config: c.ma_device_config,
    ring_buffer: *RingBuffer,
    capture_context: *CaptureContext,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    sample_rate: u32,
    source: AudioSource,
    verbose: bool,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource, verbose: bool) AudioError!Self {
        if (verbose) {
            std.log.info("miniaudio: Initializing audio capture at {d} Hz", .{sample_rate});
        }

        // Create ring buffer (2 seconds of audio)
        const ring_buffer = allocator.create(RingBuffer) catch return AudioError.OutOfMemory;
        ring_buffer.* = RingBuffer.init(allocator, sample_rate * 2) catch {
            allocator.destroy(ring_buffer);
            return AudioError.OutOfMemory;
        };

        // Create capture context and initialize BEFORE passing to device
        const capture_context = allocator.create(CaptureContext) catch {
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            return AudioError.OutOfMemory;
        };

        // Initialize context immediately with safe defaults
        capture_context.* = CaptureContext{
            .ring_buffer = ring_buffer,
            .running = std.atomic.Value(bool).init(false),  // Not started yet
            .channels = 1,  // Will be updated later if needed
            .verbose = verbose,
        };

        // Configure device
        var device_config = c.ma_device_config_init(if (source == .monitor) c.ma_device_type_loopback else c.ma_device_type_capture);
        device_config.capture.format = c.ma_format_s16;
        device_config.capture.channels = 1; // Request mono
        device_config.sampleRate = sample_rate;
        device_config.dataCallback = dataCallback;
        device_config.pUserData = capture_context;

        // For loopback (monitor), we capture what's being played
        if (source == .monitor) {
            if (verbose) {
                std.log.info("miniaudio: Using loopback capture (system audio)", .{});
            }
            // On some platforms, loopback requires stereo
            device_config.capture.channels = 2;
        }

        // Initialize device
        var device: c.ma_device = undefined;
        const result = c.ma_device_init(null, &device_config, &device);

        if (result != c.MA_SUCCESS) {
            if (verbose) {
                std.log.err("miniaudio: Failed to initialize device (error: {d})", .{result});

                // Try to provide more helpful error messages
                if (source == .monitor) {
                    std.log.err("miniaudio: Loopback capture may not be supported on this platform", .{});
                    std.log.err("miniaudio: Falling back to microphone capture...", .{});
                }
            }

            // If loopback failed, try regular capture
            if (source == .monitor) {
                device_config = c.ma_device_config_init(c.ma_device_type_capture);
                device_config.capture.format = c.ma_format_s16;
                device_config.capture.channels = 1;
                device_config.sampleRate = sample_rate;
                device_config.dataCallback = dataCallback;
                device_config.pUserData = capture_context;

                const fallback_result = c.ma_device_init(null, &device_config, &device);
                if (fallback_result != c.MA_SUCCESS) {
                    if (verbose) {
                        std.log.err("miniaudio: Fallback to microphone also failed (error: {d})", .{fallback_result});
                    }
                    allocator.destroy(capture_context);
                    ring_buffer.deinit(allocator);
                    allocator.destroy(ring_buffer);
                    return AudioError.DeviceNotFound;
                }
                if (verbose) {
                    std.log.info("miniaudio: Fallback to microphone succeeded", .{});
                }
            } else {
                allocator.destroy(capture_context);
                ring_buffer.deinit(allocator);
                allocator.destroy(ring_buffer);
                return AudioError.DeviceNotFound;
            }
        }

        if (verbose) {
            std.log.info("miniaudio: Device initialized successfully", .{});
            std.log.info("miniaudio: Actual sample rate: {d}", .{device.sampleRate});
            std.log.info("miniaudio: Actual channels: {d}", .{device.capture.channels});
        }

        // Now set up the context with the actual device info
        const actual_channels = device.capture.channels;

        // Update channels in the already-initialized context
        // Don't reinitialize the whole struct or we'll lose the running flag!
        capture_context.channels = actual_channels;

        const self = Self{
            .device = device,
            .device_config = device_config,
            .ring_buffer = ring_buffer,
            .capture_context = capture_context,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .sample_rate = device.sampleRate,
            .source = source,
            .verbose = verbose,
        };

        return self;
    }

    /// Start audio capture
    pub fn start(self: *Self) !void {
        if (self.verbose) {
            std.log.info("miniaudio: Starting capture...", .{});
        }

        // Set running BEFORE starting device so callback can process immediately
        self.capture_context.running.store(true, .release);
        self.running.store(true, .release);

        const result = c.ma_device_start(&self.device);
        if (result != c.MA_SUCCESS) {
            std.log.err("miniaudio: Failed to start device (error: {d})", .{result});
            self.capture_context.running.store(false, .release);
            self.running.store(false, .release);
            return AudioError.StartFailed;
        }

        if (self.verbose) {
            std.log.info("miniaudio: Capture started successfully", .{});
        }
    }

    /// Read audio samples
    pub fn read(self: *Self, buffer: []i16) AudioError![]i16 {
        const count = self.ring_buffer.read(buffer);

        if (count == 0) {
            if (!self.running.load(.acquire)) {
                return AudioError.Terminated;
            }
            return buffer[0..0];
        }

        return buffer[0..count];
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        self.capture_context.running.store(false, .release);
        self.running.store(false, .release);
        _ = c.ma_device_stop(&self.device);

        if (self.verbose) {
            std.log.info("miniaudio: Capture stopped", .{});
        }
    }

    /// Check if running
    pub fn isRunning(self: *Self) bool {
        return self.running.load(.acquire);
    }

    /// Get sample rate
    pub fn getSampleRate(self: *Self) u32 {
        return self.sample_rate;
    }

    /// Get audio source
    pub fn getSource(self: *Self) AudioSource {
        return self.source;
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        self.stop();
        c.ma_device_uninit(&self.device);

        self.ring_buffer.deinit(self.allocator);
        self.allocator.destroy(self.ring_buffer);
        self.allocator.destroy(self.capture_context);

        if (self.verbose) {
            std.log.info("miniaudio: Resources cleaned up", .{});
        }
    }
};
