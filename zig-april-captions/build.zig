const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // =========================================
    // Build April ASR library from source
    // =========================================
    const april_lib = b.addStaticLibrary(.{
        .name = "aprilasr",
        .target = target,
        .optimize = optimize,
    });

    // April ASR source files
    const april_sources = [_][]const u8{
        "libs/april-asr/src/init.c",
        "libs/april-asr/src/april_model.c",
        "libs/april-asr/src/april_session.c",
        "libs/april-asr/src/audio_provider.c",
        "libs/april-asr/src/fbank.c",
        "libs/april-asr/src/params.c",
        "libs/april-asr/src/proc_thread.c",
        "libs/april-asr/src/ort_util.c",
        "libs/april-asr/src/file/model_file.c",
        "libs/april-asr/src/fft/pocketfft.c",
        "libs/april-asr/src/sonic/sonic.c",
        "libs/april-asr/src/tinycthread/tinycthread.c",
    };

    const april_c_flags = [_][]const u8{
        "-std=gnu11", // Use GNU extensions for le32toh, ssize_t, etc.
        "-fPIC",
        "-DNDEBUG",
        "-D_GNU_SOURCE",
        "-D_POSIX_C_SOURCE=200809L",
        "-DUSE_TINYCTHREAD", // Use tinycthread instead of C11 threads
    };

    april_lib.addCSourceFiles(.{
        .files = &april_sources,
        .flags = &april_c_flags,
    });

    // April ASR include paths
    april_lib.addIncludePath(b.path("libs/april-asr"));
    april_lib.addIncludePath(b.path("libs/april-asr/src"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/file"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/fft"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/sonic"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/tinycthread"));

    // ONNX Runtime paths (required by April ASR)
    // Try environment variable first, then default to ~/onnxruntime
    const onnx_root = std.process.getEnvVarOwned(b.allocator, "ONNX_ROOT") catch null;
    const home_dir = std.process.getEnvVarOwned(b.allocator, "HOME") catch |_|
        std.process.getEnvVarOwned(b.allocator, "USERPROFILE") catch |_| b.dupe("/home");
    defer b.allocator.free(home_dir);
    const onnx_path = onnx_root orelse b.pathJoin(&.{ home_dir, "onnxruntime" });
    defer if (onnx_root) |p| b.allocator.free(p);

    april_lib.addIncludePath(.{ .cwd_relative = b.fmt("{s}/include", .{onnx_path}) });
    april_lib.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });

    // Link pthread for tinycthread
    april_lib.linkSystemLibrary("pthread");
    april_lib.linkSystemLibrary("m");
    april_lib.linkLibC();

    // =========================================
    // Build main executable
    // =========================================
    const exe = b.addExecutable(.{
        .name = "zig-april-captions",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Link April ASR (built from source)
    exe.linkLibrary(april_lib);

    // Add include path for april_api.h
    exe.addIncludePath(b.path("libs/april-asr"));

    // ONNX Runtime linking
    exe.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });
    exe.linkSystemLibrary("onnxruntime");

    // PulseAudio
    exe.linkSystemLibrary("pulse");
    exe.linkSystemLibrary("pulse-simple");

    // Standard libraries
    exe.linkSystemLibrary("pthread");
    exe.linkSystemLibrary("m");
    exe.linkLibC();

    // Add rpath so it finds onnxruntime at runtime
    exe.addRPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });

    b.installArtifact(exe);

    // =========================================
    // Run step
    // =========================================
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the captions tool");
    run_step.dependOn(&run_cmd.step);

}
