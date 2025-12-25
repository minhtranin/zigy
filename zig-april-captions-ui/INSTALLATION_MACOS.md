# Installing Zigy on macOS

## Quick Install

1. **Download** `Zigy_X.X.X_universal.dmg` from [Releases](../../releases)

2. **Open the DMG** and drag Zigy to Applications

3. **Allow the app** - macOS will block it the first time. Run this command in Terminal:

```bash
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
```

4. **Launch Zigy** from Applications - it will open normally! ✅

---

## Why This Step Is Needed

Zigy is not signed with an Apple Developer certificate (costs $99/year). macOS Gatekeeper blocks unsigned apps by default.

The `xattr` command removes the quarantine flag, telling macOS you trust this app.

**You only need to do this once!** After that, Zigy opens normally.

---

## Alternative Method (GUI)

If you prefer not to use Terminal:

1. Try to open Zigy - macOS will block it
2. Go to **System Settings → Privacy & Security**
3. Scroll down to find "Zigy was blocked..."
4. Click **"Open Anyway"**
5. Confirm in the dialog

Note: On some macOS versions, the "Open Anyway" button doesn't appear. In that case, use the Terminal command above.

---

## Troubleshooting

### "Binary not found" error
Make sure you downloaded the correct DMG for macOS. The file should be named:
- `Zigy_X.X.X_universal.dmg` (for macOS)

Not the `.deb` or `.AppImage` (those are for Linux).

### "Can't be opened because Apple cannot check it for malicious software"
This is expected! Use the `xattr` command above to bypass this check.

### Zigy opens but crashes immediately
1. Open Terminal
2. Run: `/Applications/Zigy.app/Contents/MacOS/zig-april-captions-ui`
3. Share the error message in [Issues](../../issues)

---

## Security Note

**Is this safe?** Yes! Zigy is open-source. You can:
- Review the code: https://github.com/[your-username]/zig-april-captions
- Build it yourself from source
- See what it does: Real-time speech recognition, no network access (except optional AI features)

The `xattr` command just tells macOS you've reviewed and trust this app.

---

## Building From Source (Advanced)

If you prefer to build it yourself:

```bash
# Clone the repo
git clone https://github.com/[your-username]/zig-april-captions-ui
cd zig-april-captions-ui

# Install dependencies
npm install

# Build Zig binary (requires Zig 0.13+)
cd ../zig-april-captions
zig build
cd ../zig-april-captions-ui

# Build Tauri app
npm run tauri build
```

The DMG will be at: `src-tauri/target/release/bundle/dmg/Zigy_*.dmg`

---

## Uninstall

1. Quit Zigy if it's running
2. Move `/Applications/Zigy.app` to Trash
3. Delete settings (optional):
   ```bash
   rm -rf ~/Library/Application\ Support/com.minhcongtran.zigy
   ```

---

## Support

- 🐛 **Bug Reports**: [GitHub Issues](../../issues)
- 💬 **Questions**: [Discussions](../../discussions)
- 📖 **Documentation**: [README](../../)
