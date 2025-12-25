# macOS Code Signing & Notarization Guide

## The Problem

macOS Gatekeeper blocks unsigned apps with no "Open Anyway" button. Users must run:
```bash
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app
```

This guide fixes it permanently with code signing and notarization.

---

## Prerequisites

### 1. Apple Developer Account
- **Cost**: $99/year
- **Sign up**: https://developer.apple.com/programs/

### 2. Developer ID Certificate
1. Go to https://developer.apple.com/account/resources/certificates
2. Create **"Developer ID Application"** certificate
3. Download and install in Keychain Access

### 3. App-Specific Password (for notarization)
1. Go to https://appleid.apple.com/account/manage
2. Generate app-specific password
3. Save it securely (needed for CI)

---

## Local Build (Testing)

### Step 1: Build the app
```bash
cd zig-april-captions-ui
npm run tauri build
```

### Step 2: Sign the app manually
```bash
# Find your signing identity
security find-identity -v -p codesigning

# Sign the .app bundle
codesign --force --deep --sign "Developer ID Application: Your Name (TEAMID)" \
  src-tauri/target/release/bundle/macos/Zigy.app

# Verify signature
codesign -vvv --deep --strict src-tauri/target/release/bundle/macos/Zigy.app
spctl -a -vvv src-tauri/target/release/bundle/macos/Zigy.app
```

### Step 3: Notarize the DMG
```bash
# Create DMG (Tauri should do this automatically)
# If not, use create-dmg or hdiutil

# Submit for notarization
xcrun notarytool submit \
  src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAMID123" \
  --password "abcd-efgh-ijkl-mnop" \
  --wait

# Staple the notarization ticket
xcrun stapler staple src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg

# Verify
xcrun stapler validate src-tauri/target/release/bundle/dmg/Zigy_0.1.0_universal.dmg
```

---

## Automated CI/CD (Recommended)

### Step 1: Export your certificate for CI

```bash
# Export certificate from Keychain
security find-identity -v -p codesigning
security export -k login.keychain-db \
  -t identities \
  -f pkcs12 \
  -P "YOUR_CERT_PASSWORD" \
  -o developer-id.p12

# Convert to base64 for GitHub Secrets
base64 -i developer-id.p12 -o cert.b64
cat cert.b64
```

### Step 2: Configure GitHub Secrets

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | Value | How to Get |
|------------|-------|------------|
| `APPLE_CERTIFICATE` | Base64 .p12 file | Output from `cat cert.b64` |
| `APPLE_CERTIFICATE_PASSWORD` | Password you used | From export command |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` | From `security find-identity` |
| `APPLE_TEAM_ID` | `TEAMID123` | From Apple Developer account |
| `APPLE_ID` | `your@email.com` | Your Apple ID |
| `APPLE_APP_PASSWORD` | `abcd-efgh-ijkl-mnop` | From appleid.apple.com |

### Step 3: Tauri Configuration

Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "minimumSystemVersion": "10.13",
      "signingIdentity": "Developer ID Application",
      "hardenedRuntime": true,
      "entitlements": "entitlements.plist"
    }
  }
}
```

### Step 4: Create Entitlements File

Create `src-tauri/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required for Tauri apps -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>

  <!-- Required for WebView -->
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>

  <!-- Required for bundled binaries (zig-april-captions) -->
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>

  <!-- Optional: if you need audio input -->
  <key>com.apple.security.device.audio-input</key>
  <true/>
</dict>
</plist>
```

### Step 5: Push and Release

```bash
# Create a release tag
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Action will:
1. Build the Zig binary (universal x86_64 + arm64)
2. Build the Tauri app
3. Sign the app with your certificate
4. Notarize the DMG with Apple
5. Staple the notarization ticket
6. Create a GitHub release with signed DMG

---

## Verification

After downloading the signed DMG, users can verify:

```bash
# Check signature
codesign -vvv --deep --strict /Applications/Zigy.app

# Check notarization
spctl -a -vvv /Applications/Zigy.app

# Should show:
# accepted
# source=Notarized Developer ID
```

---

## Troubleshooting

### "No provisioning profile found"
- This is for iOS, not macOS. Ignore it.
- Make sure you're using **Developer ID Application** (not Distribution)

### "The binary is not signed"
- Check if `APPLE_SIGNING_IDENTITY` secret is set correctly
- Verify certificate is valid: `security find-identity -v -p codesigning`

### "Notarization failed"
- Check hardened runtime is enabled
- Ensure entitlements.plist exists
- Verify app-specific password is correct

### "The signature is invalid"
- Sign the bundled Zig binary separately:
  ```bash
  codesign --force --sign "Developer ID Application: ..." \
    Zigy.app/Contents/Resources/zig-april-captions
  ```

### Users still see Gatekeeper warning
- DMG wasn't notarized
- Notarization ticket wasn't stapled
- Check with: `xcrun stapler validate Zigy.dmg`

---

## Cost Summary

- **Apple Developer Program**: $99/year
- **Code signing**: Free (included)
- **Notarization**: Free (included)

---

## Alternative: Self-Signing (Not Recommended)

Users can manually allow the app, but it's a bad UX:

```bash
# Remove quarantine attribute
sudo xattr -rd com.apple.quarantine /Applications/Zigy.app

# Or allow in System Settings
# System Settings → Privacy & Security → "Open Anyway"
```

This requires users to trust you manually. **Proper signing is much better.**

---

## Resources

- [Apple Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri Signing Docs](https://tauri.app/v1/guides/distribution/sign-macos)
- [Create App-Specific Password](https://support.apple.com/en-us/HT204397)
