# macOS Binary Bundling Fix

## What Was Fixed

### Problem 1: Binary Not Found in macOS App
**Error**: `'failed to start: Binary not found at path: zig-april-ccaptions'`

**Root Cause**: The Zig binary (`zig-april-captions`) was not being bundled into the macOS .app package.

### Problem 2: Gatekeeper Blocking App
**Error**: "App can't be opened" with no "Open Anyway" button

**Root Cause**: App not code-signed or notarized by Apple.

---

## Changes Made

### 1. Build Script (`src-tauri/build.rs`)
- ✅ Automatically builds Zig binary during Tauri build
- ✅ Copies binary to `resources/` directory
- ✅ Sets executable permissions on Unix

### 2. Tauri Config (`src-tauri/tauri.conf.json`)
- ✅ Added `resources/*` to bundle
- ✅ Added macOS signing configuration
- ✅ Enabled hardened runtime
- ✅ Referenced entitlements.plist

### 3. Entitlements (`src-tauri/entitlements.plist`)
- ✅ JIT compilation for WebView
- ✅ Unsigned executable memory for JavaScript
- ✅ Library validation disabled for bundled binary
- ✅ Audio input permission for microphone

### 4. GitHub Actions (`.github/workflows/release-macos.yml`)
- ✅ Builds universal binary (x86_64 + arm64)
- ✅ Code signs with Developer ID
- ✅ Notarizes with Apple
- ✅ Staples notarization ticket
- ✅ Creates GitHub release

---

## Testing the Fix

### Local Build (No Signing)
```bash
cd zig-april-captions-ui
npm run tauri build
```

The binary will be at:
```
src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg
```

Users will still need to bypass Gatekeeper manually:
```bash
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
```

### CI Build (With Signing)
1. Set up Apple Developer account ($99/year)
2. Configure GitHub secrets (see `MACOS_SIGNING.md`)
3. Push a tag: `git tag v0.1.0 && git push origin v0.1.0`
4. Download signed DMG from GitHub Releases
5. Users can open without any warnings! ✅

---

## Verification

After installation, check the bundle includes the binary:

```bash
ls -l /Applications/Zigy.app/Contents/Resources/zig-april-captions
```

Should show:
```
-rwxr-xr-x  1 user  staff  3820432 Dec 25 22:47 zig-april-captions
```

If signed and notarized:
```bash
codesign -vvv --deep --strict /Applications/Zigy.app
spctl -a -vvv /Applications/Zigy.app
```

Should show:
```
accepted
source=Notarized Developer ID
```

---

## Next Steps

### For Immediate Release (No Signing)
The app will work, but users need to bypass Gatekeeper once.

**Build command:**
```bash
npm run tauri build
```

**User workaround:**
```bash
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
```

### For Professional Release (Signed & Notarized)
Follow the complete guide in `MACOS_SIGNING.md`:

1. Get Apple Developer account
2. Generate certificates
3. Configure GitHub secrets
4. Use GitHub Actions for releases

**No user workarounds needed!** App opens normally on macOS.

---

## Files Changed

```
zig-april-captions-ui/
├── .github/workflows/
│   └── release-macos.yml          # NEW: CI/CD for macOS
├── src-tauri/
│   ├── build.rs                   # MODIFIED: Auto-bundle Zig binary
│   ├── tauri.conf.json           # MODIFIED: Add resources + signing config
│   ├── entitlements.plist        # NEW: macOS permissions
│   └── .gitignore                # MODIFIED: Ignore /resources/
├── MACOS_SIGNING.md              # NEW: Complete signing guide
└── MACOS_FIX_SUMMARY.md          # NEW: This file
```

---

## Quick Commands Reference

```bash
# Build Zig binary
cd zig-april-captions && zig build

# Build Tauri app (macOS)
cd zig-april-captions-ui && npm run tauri build

# Check bundled binary
ls -l src-tauri/target/release/bundle/macos/Zigy.app/Contents/Resources/

# Sign manually (if you have certificate)
codesign --force --deep --sign "Developer ID Application: Your Name (TEAMID)" \
  src-tauri/target/release/bundle/macos/Zigy.app

# Notarize DMG
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAMID" \
  --password "app-specific-password" \
  --wait

# Staple notarization
xcrun stapler staple src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg

# Release via GitHub Actions
git tag v0.1.0
git push origin v0.1.0
```

---

## Cost & Timeline

**Without Signing:**
- Cost: $0
- Time: 5 minutes (build time)
- User experience: Must bypass Gatekeeper once

**With Signing:**
- Cost: $99/year (Apple Developer)
- Time: 1-2 hours (first-time setup) + 15 min per release
- User experience: Perfect! Opens normally ✨

---

## Support

For detailed signing instructions, see: **`MACOS_SIGNING.md`**
