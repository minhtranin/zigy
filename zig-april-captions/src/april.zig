//! April ASR Zig bindings
//! Reference: https://github.com/abb128/april-asr/blob/main/april_api.h
//! Based on LiveCaptions implementation: https://github.com/abb128/LiveCaptions

const std = @import("std");

// Import April ASR C API
pub const c = @cImport({
    @cInclude("april_api.h");
});

// Re-export C types directly
pub const Model = c.AprilASRModel;
pub const Session = c.AprilASRSession;
pub const Token = c.AprilToken;
pub const Config = c.AprilConfig;
pub const SpeakerId = c.AprilSpeakerID;

/// Result type from April ASR callback
pub const ResultType = enum(c_uint) {
    unknown = 0,
    recognition_partial = 1,
    recognition_final = 2,
    error_cant_keep_up = 3,
    silence = 4,
};

/// Configuration flags for session
pub const ConfigFlags = enum(c_uint) {
    zero = 0,
    async_rt = 1, // Async with real-time requirement
    async_no_rt = 2, // Async without real-time requirement
};

/// Callback function type for recognition results
/// Must match: void(*)(void*, AprilResultType, size_t, const AprilToken*)
pub const ResultHandler = c.AprilRecognitionResultHandler;

/// April ASR API version - must match library version
pub const APRIL_VERSION = 1;

/// Initialize the April ASR API
/// Must be called before any other April functions
pub fn apiInit() void {
    c.aam_api_init(APRIL_VERSION);
}

/// Load an April ASR model from file
/// Returns null on failure
pub fn createModel(model_path: [:0]const u8) ?Model {
    return c.aam_create_model(model_path.ptr);
}

/// Get model name
pub fn getModelName(model: Model) []const u8 {
    if (c.aam_get_name(model)) |name| {
        return std.mem.span(name);
    }
    return "Unknown";
}

/// Get model description
pub fn getModelDescription(model: Model) []const u8 {
    if (c.aam_get_description(model)) |desc| {
        return std.mem.span(desc);
    }
    return "";
}

/// Get model language
pub fn getModelLanguage(model: Model) []const u8 {
    if (c.aam_get_language(model)) |lang| {
        return std.mem.span(lang);
    }
    return "unknown";
}

/// Get expected sample rate for model (typically 16000 Hz)
pub fn getSampleRate(model: Model) usize {
    return c.aam_get_sample_rate(model);
}

/// Free a model
pub fn freeModel(model: Model) void {
    c.aam_free(model);
}

/// Create a recognition session with a model and handler
pub fn createSession(model: Model, handler: ResultHandler, userdata: ?*anyopaque) ?Session {
    const config = c.AprilConfig{
        .speaker = std.mem.zeroes(c.AprilSpeakerID),
        .handler = handler,
        .userdata = userdata,
        .flags = c.APRIL_CONFIG_FLAG_ASYNC_RT_BIT,
    };
    return c.aas_create_session(model, config);
}

/// Feed PCM16 audio samples to session
/// Audio must be mono, 16-bit signed, at model's sample rate
pub fn feedPcm16(session: Session, samples: []const i16) void {
    c.aas_feed_pcm16(session, @ptrCast(@constCast(samples.ptr)), samples.len);
}

/// Flush remaining audio and finalize recognition
pub fn flush(session: Session) void {
    c.aas_flush(session);
}

/// Get real-time speedup factor
pub fn getSpeedup(session: Session) f32 {
    return c.aas_realtime_get_speedup(session);
}

/// Free a session
pub fn freeSession(session: Session) void {
    c.aas_free(session);
}

/// Helper to get token text as a Zig slice
pub fn getTokenText(token: anytype) []const u8 {
    if (token.token) |ptr| {
        return std.mem.span(ptr);
    }
    return "";
}
