//! Platform-agnostic audio capture interface
//! - Linux: PulseAudio Simple API (synchronous, no blocking issues)
//! - macOS: AudioQueue Services (Apple's official API, avoids miniaudio bus errors)
//! - Windows: miniaudio

const std = @import("std");
const builtin = @import("builtin");

// Platform-specific implementations
const pulse = if (builtin.os.tag == .linux) @import("pulse.zig") else void;
const audioqueue = if (builtin.os.tag == .macos) @import("audioqueue.zig") else void;
const miniaudio = if (builtin.os.tag == .windows) @import("miniaudio.zig") else void;

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio output
};

/// Audio capture interface - platform-specific
pub const AudioCapture = struct {
    pulse_capture: if (builtin.os.tag == .linux) pulse.AudioCapture else void,
    audioqueue_capture: if (builtin.os.tag == .macos) audioqueue.AudioCapture else void,
    miniaudio_capture: if (builtin.os.tag == .windows) miniaudio.AudioCapture else void,
    sample_rate: u32,
    source: AudioSource,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource, verbose: bool) !Self {
        if (builtin.os.tag == .linux) {
            // Linux: Use PulseAudio Simple API (synchronous, no blocking)
            std.debug.print("DEBUG: Using PulseAudio Simple API on Linux\n", .{});
            return Self{
                .pulse_capture = try pulse.AudioCapture.init(
                    sample_rate,
                    switch (source) {
                        .microphone => .microphone,
                        .monitor => .monitor,
                    },
                    verbose,
                ),
                .audioqueue_capture = undefined,
                .miniaudio_capture = undefined,
                .sample_rate = sample_rate,
                .source = source,
            };
        } else if (builtin.os.tag == .macos) {
            // macOS: Use AudioQueue Services (Apple's official API)
            std.debug.print("DEBUG: Using AudioQueue Services on macOS\n", .{});
            return Self{
                .pulse_capture = undefined,
                .audioqueue_capture = try audioqueue.AudioCapture.init(
                    allocator,
                    sample_rate,
                    switch (source) {
                        .microphone => .microphone,
                        .monitor => .monitor,
                    },
                    verbose,
                ),
                .miniaudio_capture = undefined,
                .sample_rate = sample_rate,
                .source = source,
            };
        } else {
            // Windows: Use miniaudio
            std.debug.print("DEBUG: Using miniaudio on Windows\n", .{});
            return Self{
                .pulse_capture = undefined,
                .audioqueue_capture = undefined,
                .miniaudio_capture = try miniaudio.AudioCapture.init(
                    allocator,
                    sample_rate,
                    switch (source) {
                        .microphone => .microphone,
                        .monitor => .monitor,
                    },
                    verbose,
                ),
                .sample_rate = sample_rate,
                .source = source,
            };
        }
    }

    /// Start capture
    pub fn start(self: *Self) !void {
        if (builtin.os.tag == .linux) {
            // PulseAudio Simple API starts automatically in init()
            const _running = self.pulse_capture.isRunning();
            _ = _running;
        } else if (builtin.os.tag == .macos) {
            // AudioQueue needs explicit start
            try self.audioqueue_capture.start();
        } else {
            // miniaudio needs explicit start
            try self.miniaudio_capture.start();
        }
    }

    /// Read audio samples
    pub fn read(self: *Self, buffer: []i16) ![]i16 {
        if (builtin.os.tag == .linux) {
            return self.pulse_capture.read(buffer);
        } else if (builtin.os.tag == .macos) {
            return self.audioqueue_capture.read(buffer);
        } else {
            return self.miniaudio_capture.read(buffer);
        }
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        if (builtin.os.tag == .linux) {
            self.pulse_capture.stop();
        } else if (builtin.os.tag == .macos) {
            self.audioqueue_capture.stop();
        } else {
            self.miniaudio_capture.stop();
        }
    }

    /// Check if still running
    pub fn isRunning(self: *Self) bool {
        if (builtin.os.tag == .linux) {
            return self.pulse_capture.isRunning();
        } else if (builtin.os.tag == .macos) {
            return self.audioqueue_capture.isRunning();
        } else {
            return self.miniaudio_capture.isRunning();
        }
    }

    /// Get the sample rate
    pub fn getSampleRate(self: *Self) u32 {
        return self.sample_rate;
    }

    /// Get the audio source type
    pub fn getSource(self: *Self) AudioSource {
        return self.source;
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        if (builtin.os.tag == .linux) {
            self.pulse_capture.deinit();
        } else if (builtin.os.tag == .macos) {
            self.audioqueue_capture.deinit();
        } else {
            self.miniaudio_capture.deinit();
        }
    }
};

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}
