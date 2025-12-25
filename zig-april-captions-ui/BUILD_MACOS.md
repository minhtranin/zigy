# Building Zigy for macOS

## Requirements

- **macOS computer** (or VM/CI like GitHub Actions)
- **Xcode Command Line Tools**: `xcode-select --install`
- **Homebrew**: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- **Zig 0.13+**: `brew install zig`
- **Node.js 20+**: `brew install node`
- **Rust**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

---

## Option 1: Build on macOS Computer

```bash
# Clone the repo
git clone https://github.com/[your-username]/zig-april-captions-ui
cd zig-april-captions-ui

# Install dependencies
npm install

# Build everything (Zig binary + Tauri app)
npm run tauri build
```

**Output**:
```
src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg
src-tauri/target/release/bundle/macos/Zigy.app
```

Upload the DMG to GitHub Releases! ✅

---

## Option 2: Use GitHub Actions (Free!)

GitHub provides free macOS runners. Just push a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow (`.github/workflows/release-macos.yml`) will:
1. Build on macOS runner
2. Create DMG
3. Upload to GitHub Releases automatically

**No Mac needed!** GitHub builds it for you. 🎉

---

## Building Universal Binary (Recommended)

Universal binary works on both Intel and Apple Silicon Macs.

```bash
# The default build command already creates universal binary
npm run tauri build
```

This creates:
- `Zigy_0.1.0_universal.dmg` (works on all Macs)
- `Zigy_0.1.0_aarch64.dmg` (Apple Silicon only)
- `Zigy_0.1.0_x64.dmg` (Intel only)

**Distribute the universal DMG** - it works on all Macs!

---

## Testing Before Release

```bash
# Install locally
open src-tauri/target/release/bundle/dmg/Zigy_*.dmg

# Bypass Gatekeeper for testing
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app

# Run from Applications
open /Applications/Zigy.app

# Or run from Terminal to see logs
/Applications/Zigy.app/Contents/MacOS/zig-april-captions-ui
```

---

## Verify Binary Is Bundled

```bash
# Check if zig-april-captions is included
ls -lh /Applications/Zigy.app/Contents/Resources/zig-april-captions

# Should show:
# -rwxr-xr-x  1 user  staff   3.6M Dec 25 22:47 zig-april-captions
```

If missing, the build.rs script failed. Check:
```bash
ls -lh src-tauri/resources/zig-april-captions
```

---

## Release Checklist

Before creating a GitHub release:

- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update version in `package.json`
- [ ] Build on macOS: `npm run tauri build`
- [ ] Test the DMG locally
- [ ] Verify binary is bundled (see above)
- [ ] Create git tag: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`
- [ ] GitHub Actions builds and uploads DMG
- [ ] Create release notes on GitHub
- [ ] Add installation instructions (link to `INSTALLATION_MACOS.md`)

---

## Using GitHub Actions (Recommended)

**Advantages**:
- ✅ No need for local Mac
- ✅ Consistent builds
- ✅ Automatic releases
- ✅ Free for public repos

**Setup** (one-time):
1. The workflow file already exists: `.github/workflows/release-macos.yml`
2. Push a tag: `git tag v0.1.0 && git push origin v0.1.0`
3. Check Actions tab on GitHub
4. DMG appears in Releases when done! 🎉

**Note**: Without code signing (Option A), the workflow will skip signing steps but still build the DMG.

---

## Troubleshooting

### "zig: command not found"
```bash
brew install zig
```

### "npm: command not found"
```bash
brew install node
```

### "rustc: command not found"
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Build fails with "xcrun: error"
```bash
xcode-select --install
```

### DMG not created
Check build output. Common issues:
- Zig build failed (check `../zig-april-captions/zig-out/bin/`)
- Resources not copied (check `src-tauri/resources/`)

### Binary not bundled in .app
The build.rs script copies it automatically. If missing:
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri build
```

---

## Quick Commands

```bash
# Full clean build
cd src-tauri && cargo clean && cd ..
rm -rf src-tauri/target
rm -rf src-tauri/resources
npm run tauri build

# Build Zig binary only
cd ../zig-april-captions && zig build && cd ../zig-april-captions-ui

# Check what's bundled in the DMG
hdiutil attach src-tauri/target/release/bundle/dmg/Zigy_*.dmg
ls -la /Volumes/Zigy/Zigy.app/Contents/Resources/
hdiutil detach /Volumes/Zigy
```

---

## Next Release

When you want to release a new version:

1. Update version numbers:
   ```bash
   # src-tauri/tauri.conf.json
   "version": "0.2.0"

   # package.json
   "version": "0.2.0"
   ```

2. Create and push tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. GitHub Actions builds it automatically! ✨

Or build locally and upload manually.
