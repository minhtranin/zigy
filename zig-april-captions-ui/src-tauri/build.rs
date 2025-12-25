use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Build the Zig binary before building Tauri app
    build_zig_binary();

    // Copy binary to resources directory for bundling
    prepare_binary_for_bundling();

    tauri_build::build()
}

fn build_zig_binary() {
    println!("cargo:rerun-if-changed=../../zig-april-captions/src");

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
}
