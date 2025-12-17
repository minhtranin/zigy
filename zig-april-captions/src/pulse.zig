//! PulseAudio audio capture
//! Reference: LiveCaptions audiocap-pa.c
//! Supports both microphone and system audio (monitor) capture

const std = @import("std");

const c = @cImport({
    @cInclude("pulse/simple.h");
    @cInclude("pulse/error.h");
});

pub const PulseError = error{
    ConnectionFailed,
    ReadFailed,
    Terminated,
};

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio output (for YouTube, etc.)
};

/// Audio format specification
/// Reference: LiveCaptions audiocap-pa.c - PA_SAMPLE_S16LE, mono
pub const AudioFormat = struct {
    sample_rate: u32,
    channels: u8 = 1, // Mono for speech recognition

    fn toPaSampleSpec(self: AudioFormat) c.pa_sample_spec {
        return .{
            .format = c.PA_SAMPLE_S16LE, // 16-bit signed little-endian
            .rate = self.sample_rate,
            .channels = self.channels,
        };
    }
};

/// Buffer attributes for low-latency capture
/// Reference: LiveCaptions audiocap-pa.c - 50ms fragment size
fn getBufferAttr(sample_rate: u32) c.pa_buffer_attr {
    const fragment_size = (sample_rate * 2 * 50) / 1000; // 50ms of 16-bit mono audio
    return .{
        .maxlength = std.math.maxInt(u32), // -1 in C = max value = default
        .tlength = std.math.maxInt(u32),
        .prebuf = std.math.maxInt(u32),
        .minreq = std.math.maxInt(u32),
        .fragsize = fragment_size,
    };
}

/// PulseAudio audio capture using Simple API
pub const AudioCapture = struct {
    simple: *c.pa_simple,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),

    const Self = @This();

    /// Initialize audio capture
    /// @param sample_rate: Sample rate in Hz (usually 16000 for speech)
    /// @param source: AudioSource.microphone or AudioSource.monitor
    /// Reference: LiveCaptions audiocap-pa.c - create_audio_thread_pa()
    pub fn init(sample_rate: u32, source: AudioSource) PulseError!Self {
        const format = AudioFormat{ .sample_rate = sample_rate };
        var sample_spec = format.toPaSampleSpec();
        var buffer_attr = getBufferAttr(sample_rate);
        var err: c_int = 0;

        // For monitor source, we need to specify the device
        // @default.monitor captures the default output device
        const device: ?[*:0]const u8 = switch (source) {
            .microphone => null, // Default microphone
            .monitor => "@DEFAULT_MONITOR@", // System audio output
        };

        const stream_name = switch (source) {
            .microphone => "Microphone Recognition",
            .monitor => "System Audio Recognition",
        };

        const simple = c.pa_simple_new(
            null, // Default server
            "zig-april-captions", // Application name
            c.PA_STREAM_RECORD, // Recording mode
            device, // Device: null for mic, @DEFAULT_MONITOR@ for system audio
            stream_name, // Stream description
            &sample_spec,
            null, // Default channel map
            &buffer_attr,
            &err,
        );

        if (simple == null) {
            std.log.err("PulseAudio connection failed: {s}", .{
                std.mem.span(c.pa_strerror(err)),
            });
            return PulseError.ConnectionFailed;
        }

        return Self{
            .simple = simple.?,
            .format = format,
            .source = source,
            .running = std.atomic.Value(bool).init(true),
        };
    }

    /// Read audio samples
    /// Returns slice of samples read, or error
    /// Reference: LiveCaptions audiocap-pa.c - stream_read_cb() using pa_stream_peek()
    pub fn read(self: *Self, buffer: []i16) PulseError![]i16 {
        if (!self.running.load(.acquire)) {
            return PulseError.Terminated;
        }

        var err: c_int = 0;
        const bytes_to_read = buffer.len * @sizeOf(i16);

        const result = c.pa_simple_read(
            self.simple,
            @ptrCast(buffer.ptr),
            bytes_to_read,
            &err,
        );

        if (result < 0) {
            std.log.err("PulseAudio read failed: {s}", .{
                std.mem.span(c.pa_strerror(err)),
            });
            return PulseError.ReadFailed;
        }

        return buffer;
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        self.running.store(false, .release);
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
        c.pa_simple_free(self.simple);
    }
};

// Backwards compatibility alias
pub const MicCapture = AudioCapture;

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}

test "samples calculation" {
    // 16000 Hz * 50ms = 800 samples
    try std.testing.expectEqual(@as(usize, 800), samplesForMs(16000, 50));
}
