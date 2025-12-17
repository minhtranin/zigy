//! ASR Processor - manages speech recognition pipeline
//! Reference: LiveCaptions asrproc.c

const std = @import("std");
const april = @import("april.zig");

/// Silence detection threshold (amplitude)
/// Lower threshold for system audio which may be quieter
const SILENCE_THRESHOLD: i16 = 8;

/// Number of silent samples before flushing ASR
/// Reduced for faster response
const SILENCE_FLUSH_SAMPLES: usize = 8000; // ~0.5s at 16kHz

/// ASR Processor state
pub const AsrProcessor = struct {
    model: april.Model,
    session: april.Session,
    sample_rate: usize,

    // Silence detection state
    silence_samples: usize = 0,
    has_activity: bool = false,

    // Output buffer for captions
    output_mutex: std.Thread.Mutex = .{},
    current_text: std.ArrayList(u8),
    is_final: bool = false,
    has_new_text: bool = false,

    // Error state
    is_errored: bool = false,

    const Self = @This();

    /// Initialize processor with model path
    pub fn init(allocator: std.mem.Allocator, model_path: [:0]const u8) !*Self {
        // Initialize April API
        april.apiInit();

        // Load model
        const model = april.createModel(model_path) orelse {
            std.log.err("Failed to load model: {s}", .{model_path});
            return error.ModelLoadFailed;
        };

        const sample_rate = april.getSampleRate(model);

        std.log.info("Loaded model: {s}", .{april.getModelName(model)});
        std.log.info("Language: {s}", .{april.getModelLanguage(model)});
        std.log.info("Sample rate: {} Hz", .{sample_rate});

        // Allocate processor
        const self = try allocator.create(Self);
        self.* = Self{
            .model = model,
            .session = undefined,
            .sample_rate = sample_rate,
            .current_text = std.ArrayList(u8).init(allocator),
        };

        // Create session with callback - pass self pointer as userdata
        self.session = april.createSession(model, resultCallback, @ptrCast(self)) orelse {
            april.freeModel(model);
            allocator.destroy(self);
            return error.SessionCreateFailed;
        };

        return self;
    }

    /// Process audio samples
    pub fn processAudio(self: *Self, samples: []const i16) void {
        // Activity detection - scan for non-silent samples
        var has_sound = false;
        for (samples) |sample| {
            if (sample > SILENCE_THRESHOLD or sample < -SILENCE_THRESHOLD) {
                has_sound = true;
                break;
            }
        }

        if (has_sound) {
            self.silence_samples = 0;
            self.has_activity = true;
        } else {
            self.silence_samples += samples.len;
        }

        // Feed audio to April ASR
        april.feedPcm16(self.session, samples);

        // Flush after sustained silence
        if (self.has_activity and self.silence_samples >= SILENCE_FLUSH_SAMPLES) {
            april.flush(self.session);
            self.has_activity = false;
            self.silence_samples = 0;
        }
    }

    /// Get current caption text (thread-safe)
    pub fn getText(self: *Self, buffer: []u8) struct { len: usize, is_final: bool } {
        self.output_mutex.lock();
        defer self.output_mutex.unlock();

        const len = @min(buffer.len, self.current_text.items.len);
        @memcpy(buffer[0..len], self.current_text.items[0..len]);

        self.has_new_text = false;
        return .{ .len = len, .is_final = self.is_final };
    }

    /// Check if there's new text available
    pub fn hasNewText(self: *Self) bool {
        self.output_mutex.lock();
        defer self.output_mutex.unlock();
        return self.has_new_text;
    }

    /// Check if processor encountered an error
    pub fn hasError(self: *Self) bool {
        return self.is_errored;
    }

    /// Get sample rate expected by model
    pub fn getSampleRate(self: *Self) usize {
        return self.sample_rate;
    }

    /// Get real-time speedup factor
    pub fn getSpeedup(self: *Self) f32 {
        return april.getSpeedup(self.session);
    }

    /// Clean up resources
    pub fn deinit(self: *Self, allocator: std.mem.Allocator) void {
        april.freeSession(self.session);
        april.freeModel(self.model);
        self.current_text.deinit();
        allocator.destroy(self);
    }

    /// April ASR result callback - called from C
    fn resultCallback(
        userdata: ?*anyopaque,
        result_type_raw: april.c.AprilResultType,
        num_tokens: usize,
        tokens: [*c]const april.Token,
    ) callconv(.C) void {
        const self: *Self = @ptrCast(@alignCast(userdata));
        const result_type: april.ResultType = @enumFromInt(result_type_raw);

        switch (result_type) {
            .recognition_partial, .recognition_final => {
                // Build text from tokens
                self.output_mutex.lock();
                defer self.output_mutex.unlock();

                self.current_text.clearRetainingCapacity();
                self.is_final = (result_type == .recognition_final);

                var i: usize = 0;
                while (i < num_tokens) : (i += 1) {
                    const token = tokens[i];
                    if (token.token) |ptr| {
                        const text = std.mem.span(ptr);
                        self.current_text.appendSlice(text) catch {};
                    }
                }

                self.has_new_text = true;
            },
            .error_cant_keep_up => {
                std.log.warn("ASR can't keep up with audio!", .{});
                self.is_errored = true;
            },
            .silence => {
                // Silence detected by model
            },
            .unknown => {},
        }
    }
};
