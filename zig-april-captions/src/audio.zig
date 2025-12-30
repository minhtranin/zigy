//! Platform-agnostic audio capture interface
//! Uses CoreAudio on macOS, PulseAudio on Linux, WASAPI on Windows

const std = @import("std");
const builtin = @import("builtin");

// Platform-specific implementations
const coreaudio = if (builtin.os.tag == .macos) @import("coreaudio") else void;
const pulse = if (builtin.os.tag == .linux) @import("pulse.zig") else void;
const wasapi = if (builtin.os.tag == .windows) @import("wasapi.zig") else void;

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio output
};

/// Audio capture interface - platform-agnostic
pub const AudioCapture = struct {
    // Use a union to hold the appropriate backend
    coreaudio_capture: if (builtin.os.tag == .macos) coreaudio.AudioCapture else void,
    pulse_capture: if (builtin.os.tag == .linux) pulse.AudioCapture else void,
    wasapi_capture: if (builtin.os.tag == .windows) wasapi.AudioCapture else void,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(allocator: std.mem.Allocator, sample_rate: u32, source: AudioSource) !Self {
        if (builtin.os.tag == .macos) {
            // macOS: Use CoreAudio (monitor falls back to microphone)
            return Self{
                .coreaudio_capture = try coreaudio.AudioCapture.init(allocator, sample_rate, source),
                .pulse_capture = undefined,
                .wasapi_capture = undefined,
            };
        } else if (builtin.os.tag == .windows) {
            // Windows: Always use microphone for now
            // WASAPI implementation will handle the source type internally
            return Self{
                .coreaudio_capture = undefined,
                .pulse_capture = undefined,
                .wasapi_capture = try wasapi.AudioCapture.init(sample_rate, .microphone),
            };
        } else {
            // Linux: Use PulseAudio (supports both mic and monitor)
            return Self{
                .coreaudio_capture = undefined,
                .pulse_capture = try pulse.AudioCapture.init(sample_rate, switch (source) {
                    .microphone => .microphone,
                    .monitor => .monitor,
                }),
                .wasapi_capture = undefined,
            };
        }
    }

    /// Read audio samples
    pub fn read(self: *Self, buffer: []i16) ![]i16 {
        if (builtin.os.tag == .macos) {
            return self.coreaudio_capture.read(buffer);
        } else if (builtin.os.tag == .windows) {
            return self.wasapi_capture.read(buffer);
        } else {
            return self.pulse_capture.read(buffer);
        }
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        if (builtin.os.tag == .macos) {
            self.coreaudio_capture.stop();
        } else if (builtin.os.tag == .windows) {
            self.wasapi_capture.stop();
        } else {
            self.pulse_capture.stop();
        }
    }

    /// Check if still running
    pub fn isRunning(self: *Self) bool {
        if (builtin.os.tag == .macos) {
            return self.coreaudio_capture.isRunning();
        } else if (builtin.os.tag == .windows) {
            return self.wasapi_capture.isRunning();
        } else {
            return self.pulse_capture.isRunning();
        }
    }

    /// Get the sample rate
    pub fn getSampleRate(self: *Self) u32 {
        if (builtin.os.tag == .macos) {
            return self.coreaudio_capture.getSampleRate();
        } else if (builtin.os.tag == .windows) {
            return self.wasapi_capture.getSampleRate();
        } else {
            return self.pulse_capture.getSampleRate();
        }
    }

    /// Get the audio source type
    pub fn getSource(self: *Self) AudioSource {
        if (builtin.os.tag == .macos) {
            return switch (self.coreaudio_capture.getSource()) {
                .microphone => .microphone,
                .monitor => .monitor,
            };
        } else if (builtin.os.tag == .windows) {
            return switch (self.wasapi_capture.getSource()) {
                .microphone => .microphone,
                .monitor => .monitor,
            };
        } else {
            return switch (self.pulse_capture.getSource()) {
                .microphone => .microphone,
                .monitor => .monitor,
            };
        }
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        if (builtin.os.tag == .macos) {
            self.coreaudio_capture.deinit();
        } else if (builtin.os.tag == .windows) {
            self.wasapi_capture.deinit();
        } else {
            self.pulse_capture.deinit();
        }
    }

    /// Start capture (for platforms that need explicit start)
    pub fn start(self: *Self) !void {
        if (builtin.os.tag == .macos) {
            try self.coreaudio_capture.start();
        }
        // PulseAudio and WASAPI start automatically in init()
    }
};

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}
