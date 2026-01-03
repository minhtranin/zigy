const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const is_windows = target.result.os.tag == .windows;

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

    // Build C flags based on platform
    var flags_list = std.ArrayList([]const u8).init(b.allocator);
    defer flags_list.deinit();

    // Common flags
    flags_list.append("-fPIC") catch unreachable;
    flags_list.append("-DNDEBUG") catch unreachable;
    flags_list.append("-DUSE_TINYCTHREAD") catch unreachable;

    if (!is_windows) {
        // POSIX-specific flags
        flags_list.append("-std=gnu11") catch unreachable;
        flags_list.append("-D_GNU_SOURCE") catch unreachable;
        flags_list.append("-D_POSIX_C_SOURCE=200809L") catch unreachable;
    } else {
        // Windows-specific flags
        flags_list.append("-std=c11") catch unreachable;
        flags_list.append("-D_CRT_SECURE_NO_WARNINGS") catch unreachable;
        // Include ONNX Runtime compatibility header before all other headers
        flags_list.append("-include") catch unreachable;
        flags_list.append("libs/april-asr/src/windows/onnxruntime_compat.h") catch unreachable;
    }

    const april_c_flags = flags_list.toOwnedSlice() catch unreachable;
    defer b.allocator.free(april_c_flags);

    april_lib.addCSourceFiles(.{
        .files = &april_sources,
        .flags = april_c_flags,
    });

    // April ASR include paths
    april_lib.addIncludePath(b.path("libs/april-asr"));
    april_lib.addIncludePath(b.path("libs/april-asr/src"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/file"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/fft"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/sonic"));
    april_lib.addIncludePath(b.path("libs/april-asr/src/tinycthread"));

    // Windows-specific include path for endian.h compatibility
    if (is_windows) {
        april_lib.addIncludePath(b.path("libs/april-asr/src/windows"));
    }

    // ONNX Runtime paths (required by April ASR)
    // Try environment variable first, then default to ~/onnxruntime
    const onnx_root = std.process.getEnvVarOwned(b.allocator, "ONNX_ROOT") catch null;
    const home_dir = std.process.getEnvVarOwned(b.allocator, "HOME") catch
        std.process.getEnvVarOwned(b.allocator, "USERPROFILE") catch b.dupe("/home");
    defer b.allocator.free(home_dir);
    const onnx_path = onnx_root orelse b.pathJoin(&.{ home_dir, "onnxruntime" });
    defer if (onnx_root) |p| b.allocator.free(p);

    april_lib.addIncludePath(.{ .cwd_relative = b.fmt("{s}/include", .{onnx_path}) });
    april_lib.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });

    // Platform-specific linking for April ASR
    if (!is_windows) {
        april_lib.linkSystemLibrary("pthread");
        april_lib.linkSystemLibrary("m");
    }
    april_lib.linkLibC();

    // =========================================
    // Build miniaudio library
    // =========================================
    const miniaudio_lib = b.addStaticLibrary(.{
        .name = "miniaudio",
        .target = target,
        .optimize = optimize,
    });

    // Compile miniaudio implementation
    var miniaudio_flags = std.ArrayList([]const u8).init(b.allocator);
    defer miniaudio_flags.deinit();

    miniaudio_flags.append("-fPIC") catch unreachable;

    // Platform-specific defines for miniaudio
    if (target.result.os.tag == .linux) {
        // Linux: Enable PulseAudio and ALSA backends
        miniaudio_flags.append("-DMA_ENABLE_PULSEAUDIO") catch unreachable;
        miniaudio_flags.append("-DMA_ENABLE_ALSA") catch unreachable;
    } else if (target.result.os.tag == .macos) {
        // macOS: Enable CoreAudio backend
        miniaudio_flags.append("-DMA_ENABLE_COREAUDIO") catch unreachable;
    } else if (is_windows) {
        // Windows: Enable WASAPI backend
        miniaudio_flags.append("-DMA_ENABLE_WASAPI") catch unreachable;
    }

    const miniaudio_c_flags = miniaudio_flags.toOwnedSlice() catch unreachable;
    defer b.allocator.free(miniaudio_c_flags);

    miniaudio_lib.addCSourceFiles(.{
        .files = &[_][]const u8{"libs/miniaudio/miniaudio_impl.c"},
        .flags = miniaudio_c_flags,
    });

    miniaudio_lib.addIncludePath(b.path("libs/miniaudio"));
    miniaudio_lib.linkLibC();

    // Platform-specific libraries for miniaudio
    if (target.result.os.tag == .linux) {
        miniaudio_lib.linkSystemLibrary("pthread");
        miniaudio_lib.linkSystemLibrary("m");
        miniaudio_lib.linkSystemLibrary("dl");
        // PulseAudio libraries (miniaudio loads them dynamically, but we link for compatibility)
        miniaudio_lib.linkSystemLibrary("pulse");
        miniaudio_lib.linkSystemLibrary("pulse-simple");
    } else if (target.result.os.tag == .macos) {
        miniaudio_lib.linkFramework("CoreAudio");
        miniaudio_lib.linkFramework("AudioToolbox");
        miniaudio_lib.linkFramework("CoreFoundation");
        miniaudio_lib.linkSystemLibrary("pthread");
        miniaudio_lib.linkSystemLibrary("m");
    } else if (is_windows) {
        miniaudio_lib.linkSystemLibrary("ole32");
    }

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

    // Link miniaudio
    exe.linkLibrary(miniaudio_lib);

    // Add include paths
    exe.addIncludePath(b.path("libs/april-asr"));
    exe.addIncludePath(b.path("libs/miniaudio"));

    // ONNX Runtime linking
    exe.addLibraryPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });
    exe.linkSystemLibrary("onnxruntime");

    // Platform-specific libraries (miniaudio needs these at runtime)
    if (is_windows) {
        // Windows: WASAPI libraries
        exe.linkSystemLibrary("ole32");
    } else if (target.result.os.tag == .linux) {
        // Linux: PulseAudio (miniaudio uses it)
        exe.linkSystemLibrary("pulse");
        exe.linkSystemLibrary("pulse-simple");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("m");
        exe.linkSystemLibrary("dl");
    } else if (target.result.os.tag == .macos) {
        // macOS: CoreAudio frameworks (miniaudio uses them)
        exe.linkFramework("CoreAudio");
        exe.linkFramework("AudioToolbox");
        exe.linkFramework("CoreFoundation");
        exe.linkSystemLibrary("pthread");
        exe.linkSystemLibrary("m");

        // Add Homebrew include path for ONNX Runtime (if installed via brew)
        exe.addIncludePath(.{ .cwd_relative = "/opt/homebrew/include" });
        exe.addLibraryPath(.{ .cwd_relative = "/opt/homebrew/lib" });
        exe.addRPath(.{ .cwd_relative = "/opt/homebrew/lib" });
    }

    exe.linkLibC();

    // Add rpath so it finds onnxruntime at runtime
    // For production: use platform-specific relative paths
    // Linux: $ORIGIN (finds libraries relative to executable)
    // macOS: @loader_path (finds libraries relative to executable)
    if (target.result.isDarwin()) {
        // macOS: Only add development ONNX Runtime path
        // The CI workflow will set production rpaths using install_name_tool
        // because Zig's .cwd_relative interprets @executable_path as a relative path
        // and prepends the build directory, creating hardcoded paths
        exe.addRPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });
    } else {
        // Linux: Don't set rpath here - let the CI workflow's patchelf handle it
        // The workflow sets: patchelf --set-rpath '$ORIGIN'
        // Development: add ONNX Runtime lib path for local testing
        exe.addRPath(.{ .cwd_relative = b.fmt("{s}/lib", .{onnx_path}) });
    }

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
