//! Platform-agnostic audio capture interface
//! Uses miniaudio library which handles platform differences internally:
//! - macOS: CoreAudio
//! - Linux: PulseAudio (with ALSA fallback)
//! - Windows: WASAPI

const std = @import("std");
const builtin = @import("builtin");

// Use miniaudio for all platforms
const miniaudio = @import("miniaudio.zig");

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio output
};

/// Audio capture interface - uses miniaudio internally
pub const AudioCapture = struct {
    miniaudio_capture: miniaudio.AudioCapture,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource, verbose: bool) !Self {
        return Self{
            .miniaudio_capture = try miniaudio.AudioCapture.init(
                allocator,
                sample_rate,
                switch (source) {
                    .microphone => .microphone,
                    .monitor => .monitor,
                },
                verbose,
            ),
        };
    }

    /// Start capture (miniaudio needs explicit start)
    pub fn start(self: *Self) !void {
        try self.miniaudio_capture.start();
    }

    /// Read audio samples
    pub fn read(self: *Self, buffer: []i16) ![]i16 {
        return self.miniaudio_capture.read(buffer);
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        self.miniaudio_capture.stop();
    }

    /// Check if still running
    pub fn isRunning(self: *Self) bool {
        return self.miniaudio_capture.isRunning();
    }

    /// Get the sample rate
    pub fn getSampleRate(self: *Self) u32 {
        return self.miniaudio_capture.getSampleRate();
    }

    /// Get the audio source type
    pub fn getSource(self: *Self) AudioSource {
        return switch (self.miniaudio_capture.getSource()) {
            .microphone => .microphone,
            .monitor => .monitor,
        };
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        self.miniaudio_capture.deinit();
    }
};

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}
