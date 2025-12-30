use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Build the Zig binary before building Tauri app
    build_zig_binary();

    // Copy binary to resources directory ONLY for release builds
    // Dev mode doesn't need resources - it causes infinite rebuild loops
    let is_release = env::var("PROFILE").unwrap_or_default() == "release";
    if is_release {
        prepare_binary_for_bundling();
    } else {
        println!("Dev mode detected - skipping binary bundling to avoid watch loops");
    }

    tauri_build::build()
}

fn build_zig_binary() {
    println!("cargo:rerun-if-changed=../../zig-april-captions/src");

    // Skip Zig build in CI - the workflow builds and patches the binary manually
    // This prevents build.rs from overwriting the patched binary with a fresh unpatched one
    if env::var("SKIP_ZIG_BUILD").is_ok() {
        println!("SKIP_ZIG_BUILD is set - skipping Zig binary build (CI mode)");
        println!("The workflow has already built and patched the binary");
        return;
    }

    let zig_project_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("zig-april-captions");

    if !zig_project_dir.exists() {
        eprintln!("Warning: Zig project not found at {:?}", zig_project_dir);
        eprintln!("Skipping Zig binary build. Make sure to build it manually:");
        eprintln!("  cd zig-april-captions && zig build");
        return;
    }

    println!("Building Zig binary at {:?}", zig_project_dir);

    let status = Command::new("zig")
        .arg("build")
        .current_dir(&zig_project_dir)
        .status()
        .expect("Failed to execute 'zig build'");

    if !status.success() {
        panic!("Zig build failed!");
    }

    println!("Zig binary built successfully");
}

fn prepare_binary_for_bundling() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let zig_binary_source = manifest_dir
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("zig-april-captions")
        .join("zig-out")
        .join("bin")
        .join("zig-april-captions");

    if !zig_binary_source.exists() {
        eprintln!("Warning: Zig binary not found at {:?}", zig_binary_source);
        eprintln!("The app will look for it at runtime.");
        return;
    }

    // Create resources directory
    let resources_dir = manifest_dir.join("resources");
    std::fs::create_dir_all(&resources_dir).ok();

    // Copy binary to resources
    let dest = resources_dir.join("zig-april-captions");
    std::fs::copy(&zig_binary_source, &dest)
        .expect("Failed to copy zig-april-captions to resources");

    println!("Copied Zig binary to {:?}", dest);

    // Make it executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&dest).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&dest, perms).unwrap();
        println!("Set executable permissions on binary");
    }

    // Copy ONNX Runtime libraries (required for bundling)
    // The binary's RPATH is set to $ORIGIN (Linux) / @loader_path (macOS)
    // so it expects libraries in the same directory
    copy_onnx_libraries_if_present(&resources_dir);

    // Copy PulseAudio libraries if present (bundled by CI)
    copy_pulseaudio_libraries_if_present(&resources_dir);
}

fn copy_onnx_libraries_if_present(resources_dir: &PathBuf) {
    // Try ONNX_ROOT env var first, then fall back to ~/onnxruntime
    let onnx_root = env::var("ONNX_ROOT").ok().or_else(|| {
        env::var("HOME")
            .or_else(|_| env::var("USERPROFILE"))
            .ok()
            .map(|home| format!("{}/onnxruntime", home))
    });

    let Some(onnx_path) = onnx_root else {
        println!("cargo:warning=ONNX_ROOT not set and HOME not found. Skipping ONNX library bundling.");
        println!("cargo:warning=Set ONNX_ROOT environment variable to bundle ONNX Runtime libraries.");
        return;
    };

    let lib_dir = PathBuf::from(&onnx_path).join("lib");
    if !lib_dir.exists() {
        println!("cargo:warning=ONNX Runtime lib directory not found at {}", lib_dir.display());
        println!("cargo:warning=Libraries will not be bundled. Binary may fail at runtime.");
        return;
    }

    println!("Found ONNX Runtime at: {}", lib_dir.display());

    // Copy all ONNX library files to resources
    let Ok(entries) = std::fs::read_dir(&lib_dir) else {
        return;
    };

    let mut copied_count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(filename) = path.file_name() else {
            continue;
        };
        let filename_str = filename.to_string_lossy();

        // Platform-specific library file patterns
        let is_onnx_lib = if cfg!(target_os = "linux") {
            filename_str.starts_with("libonnxruntime.so")
        } else if cfg!(target_os = "macos") {
            filename_str.starts_with("libonnxruntime") && filename_str.ends_with(".dylib")
        } else if cfg!(target_os = "windows") {
            filename_str == "onnxruntime.dll" || filename_str.ends_with(".lib")
        } else {
            false
        };

        if is_onnx_lib {
            let dest = resources_dir.join(filename);
            if std::fs::copy(&path, &dest).is_ok() {
                println!("Bundled ONNX library: {}", filename_str);
                copied_count += 1;

                // Make executable on Unix
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(metadata) = std::fs::metadata(&dest) {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = std::fs::set_permissions(&dest, perms);
                    }
                }

                // Fix rpath on macOS for dylibs
                #[cfg(target_os = "macos")]
                {
                    fix_macos_dylib_rpath(&dest);
                }
            }
        }
    }

    if copied_count == 0 {
        println!("cargo:warning=No ONNX Runtime libraries found in {}", lib_dir.display());
    } else {
        println!("Successfully bundled {} ONNX library file(s)", copied_count);
    }
}

#[cfg(target_os = "macos")]
fn fix_macos_dylib_rpath(dylib_path: &PathBuf) {
    // Fix the install name to use @rpath instead of absolute path
    let filename = dylib_path.file_name().unwrap().to_string_lossy();

    // Change the dylib install name to @rpath/filename
    let status = Command::new("install_name_tool")
        .arg("-id")
        .arg(format!("@rpath/{}", filename))
        .arg(dylib_path)
        .status();

    if let Ok(s) = status {
        if s.success() {
            println!("Fixed install name for {}", filename);
        }
    }
}

// Copy PulseAudio libraries if they exist in resources directory (bundled by CI)
// This is for Linux DEB/AppImage - macOS handles PulseAudio differently
fn copy_pulseaudio_libraries_if_present(resources_dir: &PathBuf) {
    // List of PulseAudio libraries to bundle (same as CI copies)
    let pulseaudio_libs = [
        "libpulse.so.0",
        "libpulse-simple.so.0",
        "libpulsecommon",
        "libsndfile.so.1",
        "libFLAC.so.8",
        "libvorbis.so.0",
        "libogg.so.0",
        "libvorbisenc.so.2",
    ];

    // Check if any PulseAudio libraries exist in resources
    // (They would have been copied there by the CI build)
    let Ok(entries) = std::fs::read_dir(resources_dir) else {
        return;
    };

    let mut copied_count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(filename) = path.file_name() else {
            continue;
        };
        let filename_str = filename.to_string_lossy();

        // Check if this is a PulseAudio library we want to bundle
        let is_pulseaudio_lib = pulseaudio_libs.iter().any(|lib| {
            filename_str.starts_with(lib) || filename_str.contains("pulse")
        });

        if is_pulseaudio_lib {
            // Already in resources, just log it
            println!("Found bundled PulseAudio library: {}", filename_str);
            copied_count += 1;

            // Make executable on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(&path) {
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o755);
                    let _ = std::fs::set_permissions(&path, perms);
                }
            }
        }
    }

    if copied_count > 0 {
        println!("Found {} bundled PulseAudio library file(s)", copied_count);
        println!("These will be included in the app bundle");
    }
}
