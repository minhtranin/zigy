# macOS Build Instructions

## Problem Fixed

This document addresses the macOS dylib loading issue:
```
dyld: Library not loaded: @rpath/libonnxruntime.1.16.3.dylib
referenced from: /Applications/Zigy.app/Contents/Resources/resources/zig-april-captions
```

## Solutions Implemented

### 1. Zig Binary rpath Configuration (`zig-april-captions/build.zig`)

The Zig binary now includes multiple rpaths for macOS:
- `@loader_path` - Look in same directory as binary
- `@executable_path/../Frameworks` - Look in macOS Frameworks directory
- `@executable_path/../Resources/resources` - Look in Tauri Resources directory

### 2. Tauri Rust Build Configuration (`zig-april-captions-ui/src-tauri/.cargo/config.toml`)

Added macOS-specific rustflags:
- Sets deployment target to macOS 10.13 for wider compatibility
- Configures rpaths for both Frameworks and Resources directories
- Applies to both x86_64 and aarch64 (Apple Silicon) builds

### 3. Dylib Install Name Fixing (`zig-april-captions-ui/src-tauri/build.rs`)

Added automatic `install_name_tool` processing:
- Changes dylib install names to use `@rpath` instead of absolute paths
- Runs during the Tauri build process
- Ensures dylibs can be found regardless of installation location

### 4. Tauri Bundle Configuration (`zig-april-captions-ui/src-tauri/tauri.conf.json`)

Added frameworks configuration:
- Lists ONNX Runtime dylibs to be bundled in Frameworks directory
- Tauri automatically copies them during app bundling

## Building for macOS

### Prerequisites

1. Install ONNX Runtime:
```bash
# Download ONNX Runtime for macOS
# Extract to ~/onnxruntime or set ONNX_ROOT environment variable
```

2. Install PulseAudio (via Homebrew):
```bash
brew install pulseaudio
```

### Build Process

```bash
# 1. Build Zig binary
cd zig-april-captions
zig build

# 2. Build Tauri app (will auto-copy Zig binary and dylibs)
cd ../zig-april-captions-ui
npm run tauri build
```

### Environment Variables

- `ONNX_ROOT`: Path to ONNX Runtime installation (defaults to `~/onnxruntime`)
- `MACOSX_DEPLOYMENT_TARGET`: Set to `10.13` (configured in `.cargo/config.toml`)

## Deployment Target

The app is configured to support **macOS 10.13 (High Sierra)** and later.

If you need to support older macOS versions, update:
1. `.cargo/config.toml` - `MACOSX_DEPLOYMENT_TARGET`
2. `tauri.conf.json` - `bundle.macOS.minimumSystemVersion`

## Troubleshooting

### Check dylib install names:
```bash
otool -L /Applications/Zigy.app/Contents/Resources/resources/libonnxruntime.1.16.3.dylib
```

Should show: `@rpath/libonnxruntime.1.16.3.dylib`

### Check binary rpaths:
```bash
otool -l /Applications/Zigy.app/Contents/Resources/resources/zig-april-captions | grep -A 2 LC_RPATH
```

Should show multiple rpath entries including `@executable_path/../Frameworks`

### Manual fix (if needed):
```bash
# Fix dylib install name
install_name_tool -id @rpath/libonnxruntime.1.16.3.dylib libonnxruntime.1.16.3.dylib

# Add rpath to binary
install_name_tool -add_rpath @executable_path/../Frameworks zig-april-captions
```

## References

- [Tauri macOS Bundle Documentation](https://v2.tauri.app/distribute/macos-application-bundle/)
- [Apple Dynamic Library Programming Guide](https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/DynamicLibraries/)
- [Runtime linking on Mac](https://matthew-brett.github.io/docosx/mac_runtime_link.html)
