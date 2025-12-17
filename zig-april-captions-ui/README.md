# Zipy

<div align="center">

**Real-time speech-to-text captions desktop app**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)](#-download)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-39f)](https://tauri.app)

[Features](#-features) • [Download](#-download) • [Installation](#-installation) • [Development](#-development)

</div>

---

## 📥 Download

Download the latest release for your platform from the [GitHub releases page](https://github.com/YOUR_USERNAME/zipy/releases/latest):

| Platform | Format | Download |
|----------|--------|----------|
| 🐧 Linux (x86_64) | .deb | [Download](https://github.com/YOUR_USERNAME/zipy/releases/latest) |
| 🐧 Linux (x86_64) | AppImage | [Download](https://github.com/YOUR_USERNAME/zipy/releases/latest) |
| 🍎 macOS (Apple Silicon) | .dmg | [Download](https://github.com/YOUR_USERNAME/zipy/releases/latest) |
| 🍎 macOS (Intel) | .dmg | [Download](https://github.com/YOUR_USERNAME/zipy/releases/latest) |
| 🪟 Windows (x86_64) | .exe | [Download](https://github.com/YOUR_USERNAME/zipy/releases/latest) |

## ✨ Features

- 🎤 **Real-time Speech Recognition** - Live transcription as you speak
- 💬 **AI-Powered Assistance** - Integrated Gemini AI for summaries, questions, and idea generation
- 🌐 **Multi-language Support** - Translate captions to multiple languages
- 🎨 **Simple Mode** - Minimalist view perfect for presentations and focused transcription
- 📝 **Context Optimization** - Smart conversation history compression with snapshot caching
- 🌓 **Dark Mode** - Comfortable viewing in any lighting condition
- 📋 **Timeline View** - Organized history of all summaries, questions, ideas, and greetings
- ⚙️ **Customizable Settings** - Adjust font size, language, AI model, and more

## 🚀 Installation

### Linux

#### Debian/Ubuntu (.deb)
```bash
sudo dpkg -i zipy_0.1.0_amd64.deb
sudo apt-get install -f  # Install dependencies if needed
```

#### AppImage
```bash
chmod +x zipy_0.1.0_amd64.AppImage
./zipy_0.1.0_amd64.AppImage
```

### macOS

1. Download the `.dmg` file for your Mac:
   - Choose `Zipy_0.1.0_aarch64.dmg` for Apple Silicon (M1/M2/M3)
   - Choose `Zipy_0.1.0_x64.dmg` for Intel Macs
2. Open the downloaded `.dmg` file
3. Drag **Zipy** to the **Applications** folder
4. Launch from Applications folder
5. On first launch, macOS may show "Zipy cannot be opened" → Click **Open** in System Preferences

### Windows

1. Download the `.exe` installer
2. Run the installer and follow the setup wizard
3. Windows may show "Windows protected your PC" → Click **More info** → **Run anyway**
4. Once installed, launch from Start Menu or Desktop shortcut

## 🛠️ Development

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Rust** 1.94+ ([Install](https://rustup.rs/))
- **Tauri CLI** v2 (installed via npm)

### Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/zipy.git
cd zipy

# Install dependencies
npm install

# Run in development mode (hot reload)
npm run tauri dev

# Build for production (your current platform)
npm run tauri build

# Build for specific targets
npm run tauri build -- --target x86_64-unknown-linux-gnu
npm run tauri build -- --target aarch64-apple-darwin
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target x86_64-pc-windows-msvc
```

### Development Workflow

```bash
# Build and watch for changes
npm run tauri dev

# Type check
npm run type-check

# Build release artifacts
npm run tauri build

# Clean build artifacts
rm -rf src-tauri/target
```

## 🏗️ Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Desktop Framework**: Tauri v2
- **Backend Language**: Rust
- **Speech Recognition**: April ASR
- **AI Integration**: Google Gemini API
- **Build Tool**: Vite

## 📦 Release Process

### Creating a New Release

1. Update version numbers in these files:
   ```bash
   # package.json
   "version": "0.1.0"

   # src-tauri/Cargo.toml
   version = "0.1.0"

   # src-tauri/tauri.conf.json
   "version": "0.1.0"
   ```

2. Commit and create a version tag:
   ```bash
   git add .
   git commit -m "chore: bump version to 0.1.0"
   git tag v0.1.0
   git push origin main
   git push origin v0.1.0
   ```

3. GitHub Actions will automatically:
   - Build for all platforms (Ubuntu, macOS, Windows)
   - Create a GitHub release
   - Upload all installers
   - Publish the release

4. Check the release progress:
   - Go to `https://github.com/YOUR_USERNAME/zipy/actions`
   - Monitor the "Release" workflow (takes ~10-15 minutes)
   - Download and test installers

### Build Artifacts

After a successful release, you'll find:

**Linux:**
- `zipy_0.1.0_amd64.deb` - Debian package
- `zipy_0.1.0_amd64.AppImage` - Portable Linux app

**macOS:**
- `Zipy_0.1.0_aarch64.dmg` - Apple Silicon installer
- `Zipy_0.1.0_x64.dmg` - Intel Mac installer

**Windows:**
- `Zipy_0.1.0_x64_en-US.msi` - Windows installer
- `Zipy_0.1.0_x64-setup.exe` - Setup executable

## 🔧 Troubleshooting

### Installation Issues

**macOS: "Zipy cannot be opened"**
- Right-click the app → Click "Open"
- Or go to System Preferences → Security & Privacy → Allow

**Windows: "Windows protected your PC"**
- Click "More info" → "Run anyway"
- This is normal for unsigned applications

**Linux: AppImage permission denied**
```bash
chmod +x zipy_0.1.0_amd64.AppImage
./zipy_0.1.0_amd64.AppImage
```

### Build Issues

**Build fails on macOS**
- Ensure Xcode Command Line Tools are installed: `xcode-select --install`
- Update Rust: `rustup update`

**Build fails on Linux**
- Install required dependencies:
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev \
    librsvg2-dev patchelf libssl-dev
  ```

**Release workflow not triggering**
- Ensure tag follows `v*.*.*` pattern (e.g., `v0.1.0`, `v1.2.3`)
- Verify tag was pushed: `git push origin v0.1.0`
- Check GitHub Actions is enabled in repository settings

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

Copyright (c) 2025 Minh Cong Tran

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) - Modern desktop app framework
- Speech recognition powered by [April ASR](https://github.com/abb128/april-asr)
- AI features powered by [Google Gemini API](https://ai.google.dev/)
- UI built with [React](https://react.dev/) and [Tailwind CSS](https://tailwindcss.com/)

---

<div align="center">
Made with ❤️ by Minh Cong Tran
</div>
