//! zig-april-captions - Real-time speech-to-text
//!
//! A Zig reimplementation of key components from LiveCaptions
//! Reference: https://github.com/abb128/LiveCaptions
//!
//! Usage:
//!   zig-april-captions <model.april>              # Microphone input
//!   zig-april-captions --monitor <model.april>    # System audio (YouTube, etc.)
//!   zig-april-captions --json <model.april>       # JSON output mode (for UI integration)
//!
//! Press Ctrl+C to exit

const std = @import("std");
const april = @import("april.zig");
const pulse = @import("pulse.zig");
const AsrProcessor = @import("processor.zig").AsrProcessor;

const VERSION = "0.3.0";

/// Output mode for captions
const OutputMode = enum {
    terminal, // Human-readable terminal output with colors
    json, // JSON lines for UI integration
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    // Parse arguments
    var model_path: ?[]const u8 = null;
    var audio_source = pulse.AudioSource.microphone;
    var output_mode = OutputMode.terminal;

    var i: usize = 1;
    while (i < args.len) : (i += 1) {
        const arg = args[i];

        if (std.mem.eql(u8, arg, "--help") or std.mem.eql(u8, arg, "-h")) {
            printUsage(args[0]);
            return;
        } else if (std.mem.eql(u8, arg, "--version") or std.mem.eql(u8, arg, "-v")) {
            std.debug.print("zig-april-captions {s}\n", .{VERSION});
            return;
        } else if (std.mem.eql(u8, arg, "--monitor") or std.mem.eql(u8, arg, "-m")) {
            audio_source = pulse.AudioSource.monitor;
        } else if (std.mem.eql(u8, arg, "--mic")) {
            audio_source = pulse.AudioSource.microphone;
        } else if (std.mem.eql(u8, arg, "--json") or std.mem.eql(u8, arg, "-j")) {
            output_mode = OutputMode.json;
        } else if (arg[0] != '-') {
            model_path = arg;
        } else {
            std.debug.print("Unknown option: {s}\n", .{arg});
            printUsage(args[0]);
            return;
        }
    }

    if (model_path == null) {
        std.debug.print("Error: No model file specified\n\n", .{});
        printUsage(args[0]);
        return;
    }

    // Ensure model path is null-terminated for C
    const model_path_z = try allocator.dupeZ(u8, model_path.?);
    defer allocator.free(model_path_z);

    const source_name = switch (audio_source) {
        .microphone => "Microphone",
        .monitor => "System Audio",
    };

    // Get stdout for JSON output
    const stdout = std.io.getStdOut().writer();

    // Only print banner in terminal mode
    if (output_mode == .terminal) {
        std.debug.print("\n", .{});
        std.debug.print("╔══════════════════════════════════════════╗\n", .{});
        std.debug.print("║     zig-april-captions v{s}            ║\n", .{VERSION});
        std.debug.print("║     Real-time Speech Recognition         ║\n", .{});
        std.debug.print("╚══════════════════════════════════════════╝\n", .{});
        std.debug.print("\n", .{});
    } else {
        // JSON mode: emit ready event
        try stdout.print("{{\"type\":\"ready\",\"version\":\"{s}\",\"source\":\"{s}\"}}\n", .{ VERSION, source_name });
    }

    // Initialize ASR processor
    // Reference: LiveCaptions main.c - create_asr_thread()
    if (output_mode == .terminal) {
        std.debug.print("Loading model: {s}\n", .{model_path.?});
    }
    const processor = AsrProcessor.init(allocator, model_path_z) catch |err| {
        if (output_mode == .json) {
            stdout.print("{{\"type\":\"error\",\"message\":\"Failed to initialize ASR: {}\"}}\n", .{err}) catch {};
        } else {
            std.debug.print("Error: Failed to initialize ASR - {}\n", .{err});
            std.debug.print("\nMake sure:\n", .{});
            std.debug.print("  1. The model file exists and is readable\n", .{});
            std.debug.print("  2. ONNX Runtime is installed (libonnxruntime.so)\n", .{});
            std.debug.print("  3. April ASR is installed (libaprilasr.so)\n", .{});
        }
        return;
    };
    defer processor.deinit(allocator);

    // Initialize PulseAudio audio capture
    // Reference: LiveCaptions main.c - create_audio_thread()
    if (output_mode == .terminal) {
        std.debug.print("Initializing {s}...\n", .{source_name});
    }
    var audio = pulse.AudioCapture.init(@intCast(processor.getSampleRate()), audio_source) catch |err| {
        if (output_mode == .json) {
            stdout.print("{{\"type\":\"error\",\"message\":\"Failed to open {s}: {}\"}}\n", .{ source_name, err }) catch {};
        } else {
            std.debug.print("Error: Failed to open {s} - {}\n", .{ source_name, err });
            std.debug.print("\nMake sure:\n", .{});
            std.debug.print("  1. PulseAudio is running\n", .{});
            if (audio_source == .microphone) {
                std.debug.print("  2. A microphone is connected\n", .{});
            } else {
                std.debug.print("  2. Audio is playing (e.g., YouTube video)\n", .{});
            }
        }
        return;
    };
    defer audio.deinit();

    // Setup signal handler for graceful exit
    setupSignalHandler(&audio);

    if (output_mode == .terminal) {
        std.debug.print("\n", .{});
        std.debug.print("Source: {s}\n", .{source_name});
        std.debug.print("Listening... (Press Ctrl+C to exit)\n", .{});
        std.debug.print("────────────────────────────────────────────\n", .{});
        std.debug.print("\n", .{});
    } else {
        try stdout.print("{{\"type\":\"listening\",\"source\":\"{s}\"}}\n", .{source_name});
    }

    // Audio buffer - 50ms chunks
    // Reference: LiveCaptions audiocap-pa.c - 50ms fragment size
    const chunk_samples = pulse.samplesForMs(@intCast(processor.getSampleRate()), 50);
    var audio_buffer: [4096]i16 = undefined;
    const buffer_slice = audio_buffer[0..chunk_samples];

    // Text output buffer
    var text_buffer: [4096]u8 = undefined;
    var last_text_len: usize = 0;
    var last_was_final = false;

    // Main loop
    // Reference: LiveCaptions - audio capture → ASR processing → display
    while (audio.isRunning()) {
        // Read audio
        const samples = audio.read(buffer_slice) catch |err| {
            if (err == pulse.PulseError.Terminated) break;
            if (output_mode == .terminal) {
                std.debug.print("Audio error: {}\n", .{err});
            }
            continue;
        };

        // Feed to ASR processor
        processor.processAudio(samples);

        // Check for new captions
        if (processor.hasNewText()) {
            const result = processor.getText(&text_buffer);

            if (result.len > 0) {
                const text = text_buffer[0..result.len];
                const timestamp = std.time.milliTimestamp();

                if (output_mode == .json) {
                    // JSON output mode - escape text for JSON
                    const caption_type = if (result.is_final) "final" else "partial";
                    stdout.print("{{\"type\":\"caption\",\"captionType\":\"{s}\",\"text\":\"", .{caption_type}) catch {};
                    // Write escaped text
                    for (text) |c| {
                        switch (c) {
                            '"' => stdout.writeAll("\\\"") catch {},
                            '\\' => stdout.writeAll("\\\\") catch {},
                            '\n' => stdout.writeAll("\\n") catch {},
                            '\r' => stdout.writeAll("\\r") catch {},
                            '\t' => stdout.writeAll("\\t") catch {},
                            else => stdout.writeByte(c) catch {},
                        }
                    }
                    stdout.print("\",\"timestamp\":{d}}}\n", .{timestamp}) catch {};
                } else {
                    // Terminal output mode
                    // Clear previous partial text (move cursor up and clear line)
                    if (last_text_len > 0 and !last_was_final) {
                        std.debug.print("\r\x1b[K", .{}); // Clear current line
                    }

                    // Print caption
                    if (result.is_final) {
                        // Final result - print with newline
                        std.debug.print("{s}\n", .{text});
                    } else {
                        // Partial result - print without newline (will be updated)
                        std.debug.print("\x1b[90m{s}\x1b[0m", .{text}); // Gray for partial
                    }
                }

                last_text_len = result.len;
                last_was_final = result.is_final;
            }
        }

        // Check for errors
        if (processor.hasError()) {
            if (output_mode == .json) {
                stdout.print("{{\"type\":\"warning\",\"message\":\"ASR falling behind. CPU may be too slow.\"}}\n", .{}) catch {};
            } else {
                std.debug.print("\n\x1b[33mWarning: ASR falling behind. CPU may be too slow.\x1b[0m\n", .{});
            }
        }
    }

    if (output_mode == .json) {
        stdout.print("{{\"type\":\"stopped\"}}\n", .{}) catch {};
    } else {
        std.debug.print("\n────────────────────────────────────────────\n", .{});
        std.debug.print("Stopped.\n", .{});
    }
}

fn printUsage(program: []const u8) void {
    std.debug.print(
        \\zig-april-captions - Real-time speech-to-text
        \\
        \\Usage: {s} [options] <model.april>
        \\
        \\Arguments:
        \\  model.april       Path to April ASR model file
        \\
        \\Options:
        \\  -m, --monitor     Capture system audio (YouTube, videos, etc.)
        \\      --mic         Capture from microphone (default)
        \\  -j, --json        Output JSON lines (for UI integration)
        \\  -h, --help        Show this help message
        \\  -v, --version     Show version
        \\
        \\Examples:
        \\  {s} model.april                    # From microphone
        \\  {s} --monitor model.april          # From system audio (YouTube)
        \\  {s} --json model.april             # JSON output for UI integration
        \\
        \\Download models from:
        \\  https://github.com/abb128/april-asr#models
        \\
    , .{ program, program, program, program });
}

// Global reference for signal handler
var global_audio: ?*pulse.AudioCapture = null;

fn setupSignalHandler(audio: *pulse.AudioCapture) void {
    global_audio = audio;

    const handler = struct {
        fn handle(_: c_int) callconv(.C) void {
            if (global_audio) |a| {
                a.stop();
            }
        }
    }.handle;

    const act = std.posix.Sigaction{
        .handler = .{ .handler = handler },
        .mask = std.posix.empty_sigset,
        .flags = 0,
    };

    std.posix.sigaction(std.posix.SIG.INT, &act, null) catch {};
    std.posix.sigaction(std.posix.SIG.TERM, &act, null) catch {};
}
