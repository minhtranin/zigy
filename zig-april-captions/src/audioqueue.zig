//! AudioQueue-based audio capture for macOS
//! Reference: Apple AudioQueue Services Programming Guide
//! Uses Apple's official AudioQueueNewInput API for reliable audio capture

const std = @import("std");

// Import AudioToolbox framework for AudioQueue
const c = @cImport({
    @cInclude("AudioToolbox/AudioQueue.h");
    @cInclude("AudioToolbox/AudioFormat.h");
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
    monitor, // Capture system audio output (not supported via AudioQueue)
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

/// Capture context passed to AudioQueue callback
const CaptureContext = struct {
    ring_buffer: *RingBuffer,
    running: std.atomic.Value(bool),
    buffers: []c.AudioQueueBufferRef,
    verbose: bool,
};

/// AudioQueue input callback - called when audio data is available
/// This is called by AudioQueue when a buffer is filled with audio data
fn audioQueueInputCallback(
    inUserData: ?*anyopaque,
    inAQ: c.AudioQueueRef,
    inBuffer: c.AudioQueueBufferRef,
    inStartTime: [*c]const c.AudioTimeStamp,
    inNumberPacketDescriptions: u32,
    inPacketDescs: [*c]const c.AudioStreamPacketDescription,
) callconv(.C) void {
    _ = inStartTime;
    _ = inNumberPacketDescriptions;
    _ = inPacketDescs;

    if (inUserData == null) return;
    const ctx = @as(*CaptureContext, @ptrCast(@alignCast(inUserData)));

    if (!ctx.running.load(.acquire)) {
        return;
    }

    // Get the audio data from the buffer
    const audio_data = @as([*]i16, @ptrCast(@alignCast(inBuffer.*.mAudioData)));
    const audio_data_byte_size = inBuffer.*.mAudioDataByteSize;
    const sample_count = audio_data_byte_size / @sizeOf(i16);

    // Write to ring buffer
    if (sample_count > 0) {
        ctx.ring_buffer.write(audio_data[0..sample_count]);
    }

    // Re-enqueue the buffer for more recording
    _ = c.AudioQueueEnqueueBuffer(inAQ, inBuffer, 0, null);
}

pub const AudioCapture = struct {
    queue: c.AudioQueueRef,
    ring_buffer: *RingBuffer,
    capture_context: *CaptureContext,
    running: std.atomic.Value(bool),
    allocator: std.mem.Allocator,
    sample_rate: u32,
    source: AudioSource,
    verbose: bool,
    buffer_size: u32,

    const Self = @This();

    // Number of buffers for audio queue (3 is standard for recording)
    const NUMBER_BUFFERS = 3;

    /// Initialize audio capture using Apple's AudioQueue Services
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource, verbose: bool) AudioError!Self {
        if (verbose) {
            std.log.info("AudioQueue: Initializing audio capture at {d} Hz", .{sample_rate});
        }

        // AudioQueue only supports microphone input, not system audio (loopback)
        if (source == .monitor) {
            if (verbose) {
                std.log.warn("AudioQueue: Monitor (system audio) capture not supported, falling back to microphone", .{});
            }
        }

        // Create ring buffer (2 seconds of audio)
        const ring_buffer = allocator.create(RingBuffer) catch return AudioError.OutOfMemory;
        ring_buffer.* = RingBuffer.init(allocator, sample_rate * 2) catch {
            allocator.destroy(ring_buffer);
            return AudioError.OutOfMemory;
        };

        // Create capture context
        const capture_context = allocator.create(CaptureContext) catch {
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            return AudioError.OutOfMemory;
        };

        // Allocate buffer array
        const buffers = allocator.alloc(c.AudioQueueBufferRef, NUMBER_BUFFERS) catch {
            allocator.destroy(capture_context);
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            return AudioError.OutOfMemory;
        };

        // Set up the audio format description
        // Using Linear PCM 16-bit mono for speech recognition
        var data_format: c.AudioStreamBasicDescription = undefined;
        data_format.mFormatID = c.kAudioFormatLinearPCM;
        data_format.mSampleRate = @as(f64, @floatFromInt(sample_rate));
        data_format.mChannelsPerFrame = 1; // Mono for speech recognition
        data_format.mBitsPerChannel = 16;
        data_format.mFramesPerPacket = 1;
        data_format.mBytesPerFrame = (data_format.mChannelsPerFrame * data_format.mBitsPerChannel) / 8;
        data_format.mBytesPerPacket = data_format.mBytesPerFrame * data_format.mFramesPerPacket;
        data_format.mFormatFlags = c.kLinearPCMFormatFlagIsSignedInteger | c.kLinearPCMFormatFlagIsPacked;

        // Create the audio queue for input (recording)
        var queue: c.AudioQueueRef = undefined;
        const status = c.AudioQueueNewInput(
            &data_format,
            audioQueueInputCallback,
            capture_context,
            null, // Use internal run loop
            null, // Run loop mode
            0,    // Reserved flags
            &queue,
        );

        if (status != c.noErr) {
            if (verbose) {
                std.log.err("AudioQueue: Failed to create audio queue (status: {d})", .{status});
            }
            allocator.free(buffers);
            allocator.destroy(capture_context);
            ring_buffer.deinit(allocator);
            allocator.destroy(ring_buffer);
            return AudioError.InitializeFailed;
        }

        // Get the actual format from the queue (it might be different)
        var actual_format: c.AudioStreamBasicDescription = undefined;
        var size = @sizeOf(c.AudioStreamBasicDescription);
        _ = c.AudioQueueGetProperty(queue, c.kAudioQueueProperty_StreamDescription, &actual_format, &size);

        if (verbose) {
            std.log.info("AudioQueue: Actual sample rate: {d}", .{actual_format.mSampleRate});
            std.log.info("AudioQueue: Actual channels: {d}", .{actual_format.mChannelsPerFrame});
        }

        // Calculate buffer size (50ms of audio)
        const buffer_size = @as(u32, @intFromFloat(actual_format.mSampleRate * 0.05)) *
            @as(u32, @intCast(actual_format.mBytesPerFrame));

        // Allocate and enqueue buffers
        var i: usize = 0;
        while (i < NUMBER_BUFFERS) : (i += 1) {
            const buf_status = c.AudioQueueAllocateBuffer(queue, buffer_size, &buffers[i]);
            if (buf_status != c.noErr) {
                if (verbose) {
                    std.log.err("AudioQueue: Failed to allocate buffer {d} (status: {d})", .{ i, buf_status });
                }
                // Clean up previously allocated buffers
                var j: usize = 0;
                while (j < i) : (j += 1) {
                    _ = c.AudioQueueFreeBuffer(queue, buffers[j]);
                }
                _ = c.AudioQueueDispose(queue, true);
                allocator.free(buffers);
                allocator.destroy(capture_context);
                ring_buffer.deinit(allocator);
                allocator.destroy(ring_buffer);
                return AudioError.BufferError;
            }

            // Initialize buffer to silence
            @memset(@as([*]u8, @ptrCast(@alignCast(buffers[i].*.mAudioData)))[0..buffer_size], 0);

            // Enqueue the buffer
            const enqueue_status = c.AudioQueueEnqueueBuffer(queue, buffers[i], 0, null);
            if (enqueue_status != c.noErr) {
                if (verbose) {
                    std.log.err("AudioQueue: Failed to enqueue buffer {d} (status: {d})", .{ i, enqueue_status });
                }
                // Clean up
                var j: usize = 0;
                while (j <= i) : (j += 1) {
                    _ = c.AudioQueueFreeBuffer(queue, buffers[j]);
                }
                _ = c.AudioQueueDispose(queue, true);
                allocator.free(buffers);
                allocator.destroy(capture_context);
                ring_buffer.deinit(allocator);
                allocator.destroy(ring_buffer);
                return AudioError.BufferError;
            }
        }

        // Initialize capture context
        capture_context.* = CaptureContext{
            .ring_buffer = ring_buffer,
            .running = std.atomic.Value(bool).init(false),
            .buffers = buffers,
            .verbose = verbose,
        };

        const self = Self{
            .queue = queue,
            .ring_buffer = ring_buffer,
            .capture_context = capture_context,
            .running = std.atomic.Value(bool).init(false),
            .allocator = allocator,
            .sample_rate = @intFromFloat(actual_format.mSampleRate),
            .source = source,
            .verbose = verbose,
            .buffer_size = buffer_size,
        };

        if (verbose) {
            std.log.info("AudioQueue: Audio queue initialized successfully", .{});
        }

        return self;
    }

    /// Start audio capture
    pub fn start(self: *Self) !void {
        if (self.verbose) {
            std.log.info("AudioQueue: Starting capture...", .{});
        }

        // Set running flag
        self.capture_context.running.store(true, .release);
        self.running.store(true, .release);

        const status = c.AudioQueueStart(self.queue, null);
        if (status != c.noErr) {
            std.log.err("AudioQueue: Failed to start (status: {d})", .{status});
            self.capture_context.running.store(false, .release);
            self.running.store(false, .release);
            return AudioError.StartFailed;
        }

        if (self.verbose) {
            std.log.info("AudioQueue: Capture started successfully", .{});
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

        // Stop the audio queue
        _ = c.AudioQueueStop(self.queue, 1);

        if (self.verbose) {
            std.log.info("AudioQueue: Capture stopped", .{});
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

        // Free all buffers
        for (self.capture_context.buffers) |buf| {
            _ = c.AudioQueueFreeBuffer(self.queue, buf);
        }
        self.allocator.free(self.capture_context.buffers);

        // Dispose the audio queue
        _ = c.AudioQueueDispose(self.queue, 1);

        // Free ring buffer
        self.ring_buffer.deinit(self.allocator);
        self.allocator.destroy(self.ring_buffer);

        // Free capture context
        self.allocator.destroy(self.capture_context);

        if (self.verbose) {
            std.log.info("AudioQueue: Resources cleaned up", .{});
        }
    }
};
