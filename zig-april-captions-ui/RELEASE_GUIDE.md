# Release Guide (Free Option - No Signing)

## Quick Start

You can release macOS builds **completely free** using GitHub Actions. No Apple Developer account needed!

---

## How to Release

### 1. Push a tag to GitHub

```bash
# Update version in src-tauri/tauri.conf.json and package.json first
git add .
git commit -m "Release v0.1.0"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

### 2. GitHub Actions builds it automatically

- Go to **Actions** tab on GitHub
- Wait ~15 minutes for build to complete
- macOS DMG appears in **Releases** (draft)

### 3. Edit and publish the release

- Add release notes
- The installation instructions are already there! ✅
- Click **Publish release**

---

## What Users See

When users download and install:

1. Download `Zigy_0.1.0_universal.dmg`
2. Drag to Applications
3. macOS blocks it (expected!)
4. Run this command:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
   ```
5. App opens normally! ✅

**They only do this once.** After that, Zigy works like any other app.

---

## Files Changed

All the changes are already done! ✅

```
✅ src-tauri/build.rs - Auto-bundles Zig binary
✅ src-tauri/tauri.conf.json - Includes resources
✅ .github/workflows/release-macos.yml - Builds on GitHub
✅ INSTALLATION_MACOS.md - User instructions
```

---

## Testing Locally (if you have a Mac)

```bash
# On macOS
npm run tauri build

# Test the DMG
open src-tauri/target/release/bundle/dmg/Zigy_*.dmg
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
open /Applications/Zigy.app
```

---

## Current Status

✅ **Binary bundling** - Fixed! Zig binary is included in .app
✅ **GitHub Actions** - Ready! Just push a tag
✅ **User instructions** - Written in INSTALLATION_MACOS.md
⏭️ **Code signing** - Optional, costs $99/year (not needed for now)

---

## Next Release

When you want to release v0.2.0:

1. Update versions:
   - `src-tauri/tauri.conf.json` → `"version": "0.2.0"`
   - `package.json` → `"version": "0.2.0"`

2. Push tag:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. Done! GitHub builds it automatically. 🎉

---

## Cost

**Total cost: $0** ✅

- GitHub Actions: Free for public repos
- macOS runner: Free (2000 min/month)
- DMG hosting: Free on GitHub Releases
- Code signing: Not needed (users run one command)

---

## User Experience

**First time (one command):**
```bash
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
```

**After that:**
Just like any other app! Opens normally from Applications. ✨

---

## When to Consider Signing

If you get many users and want to improve UX, consider paying for Apple Developer ($99/year):

**Without signing (free):**
- ❌ Users see "can't be opened" warning
- ✅ One Terminal command fixes it
- ✅ $0 cost

**With signing ($99/year):**
- ✅ Opens normally (no warnings)
- ✅ Better user trust
- ❌ $99/year cost

For now, free option works great! 👍

---

## Summary

Everything is ready! Just:

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub builds the DMG → appears in Releases → users download and install with one command. ✅
