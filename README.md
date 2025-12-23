# Zipy - Real-time Speech-to-Text Desktop App

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)](#download)

This repository contains the complete Zipy project - a real-time speech-to-text captions desktop application built with Tauri, React, TypeScript, and Zig.

## 📦 Repository Structure

This is a monorepo containing two main components:

```
zigy/
├── zig-april-captions/       # Speech recognition engine (Zig)
│   └── Zig wrapper for April ASR library
│
├── zig-april-captions-ui/    # Desktop application (Tauri + React)
│   └── Main UI with AI features and caption display
│
└── .github/workflows/        # CI/CD automation
    └── release.yml           # Multi-platform release builds
```

## 🎯 What is Zipy?

Zipy is a desktop application that provides:
- 🎤 **Real-time speech recognition** using April ASR
- 💬 **AI-powered assistance** with Google Gemini API
- 🌐 **Multi-language support** and translation
- 🎨 **Simple mode** for presentations
- 📋 **Timeline view** of conversation history

## 📥 Download

Get the latest release from [GitHub Releases](https://github.com/minhtranin/zigy/releases/latest)

**Available platforms:**
- 🐧 Linux: `.deb` and `AppImage`
- 🍎 macOS: Apple Silicon only (M1/M2/M3/M4)
- 🪟 Windows: `.exe` installer (UI only, no speech recognition)

---

## 📖 Installation Guide for Everyone

### 🎯 New to Installing Apps? Start Here!

**Never installed software from GitHub before?** No worries! We've got you covered.

👉 **[Complete Step-by-Step Installation Guide](zig-april-captions-ui/README.md#-quick-start-guide)** 👈

**What you'll learn:**
- ✅ How to download Zipy for Windows, Mac, or Linux
- ✅ How to install it on your computer (with pictures!)
- ✅ How to download and set up voice recognition (5 minutes, one-time)
- ✅ How to fix common problems

**Total time:** About 5-10 minutes for first-time setup.

---

### ⚡ Quick Install (For Experienced Users)

1. Download installer from [releases](https://github.com/minhtranin/zigy/releases/latest)
2. Install Zipy
3. Download model: [`april-english-dev-01110_en.april`](https://april.sapples.net/) (322 MB)
4. Open Zipy → Settings → Browse → Select model file
5. Click Start and begin speaking!

## 🏗️ Architecture

### zig-april-captions (Speech Engine)
- **Language:** Zig
- **Purpose:** Captures audio and performs speech-to-text
- **Technology:** April ASR library + PulseAudio
- **Output:** JSON stream of captions

### zig-april-captions-ui (Main Application)
- **Frontend:** React 19 + TypeScript + Tailwind CSS
- **Desktop:** Tauri v2 (Rust)
- **Purpose:** UI, AI features, settings, export
- **Integration:** Spawns zig-april-captions as subprocess

## 🚀 Quick Start for Developers

### Build Both Projects

```bash
# Clone the repository
git clone https://github.com/minhtranin/zigy.git
cd zigy

# Build the speech engine
cd zig-april-captions
zig build -Doptimize=ReleaseFast

# Build the UI app
cd ../zig-april-captions-ui
npm install
npm run tauri dev
```

### Prerequisites

- **Node.js** 20+
- **Rust** 1.94+
- **Zig** nightly
- **ONNX Runtime** (for April ASR)

<details>
<summary><b>📚 Detailed Setup Guide (Click to Expand)</b></summary>

### For Non-Technical Users

If you just want to use Zipy (not develop it), follow these simple steps:

#### Step 1: Download Zipy

1. Go to our [Releases page](https://github.com/minhtranin/zigy/releases/latest)
2. Look for the **Assets** section at the bottom
3. Download the file for your system:
   - **Windows**: `Zipy_x.x.x_x64-setup.exe`
   - **macOS** (M1/M2/M3/M4): `Zipy_x.x.x_aarch64.dmg`
   - **Linux** (Ubuntu/Debian): `zipy_x.x.x_amd64.deb`
   - **Linux** (Other): `zipy_x.x.x_amd64.AppImage`

#### Step 2: Install Zipy

**Windows:**
- Double-click the `.exe` file
- Click "More info" if you see a security warning, then "Run anyway"
- Follow the installation wizard

**macOS:**
- Open the `.dmg` file
- Drag Zipy to Applications
- Right-click Zipy → Open (first time only)

**Linux:**
- Open Terminal in your Downloads folder
- For .deb: `sudo dpkg -i zipy_0.1.0_amd64.deb`
- For AppImage: `chmod +x zipy_0.1.0_amd64.AppImage && ./zipy_0.1.0_amd64.AppImage`

#### Step 3: Download Voice Model

1. Visit https://april.sapples.net/
2. Download `april-english-dev-01110_en.april` (322 MB)
3. Save it to Documents folder

#### Step 4: Set Up Zipy

1. Open Zipy
2. Click Settings (⚙️ gear icon)
3. Click "Browse" next to ASR Model
4. Select the `april-english-dev-01110_en.april` file you downloaded
5. Click Save

✅ **Done!** Click "Start" and begin speaking.

---

### For Developers

Full development setup instructions available in [zig-april-captions-ui/README.md](zig-april-captions-ui/README.md#-development)

</details>

## 📦 Release Process

Releases are fully automated via GitHub Actions:

1. Update version in 3 files:
   - `zig-april-captions-ui/package.json`
   - `zig-april-captions-ui/src-tauri/Cargo.toml`
   - `zig-april-captions-ui/src-tauri/tauri.conf.json`

2. Create and push version tag:
   ```bash
   git tag v0.1.0
   git push origin main
   git push origin v0.1.0
   ```

3. GitHub Actions automatically:
   - Builds zig-april-captions for all platforms
   - Builds UI app with bundled binary
   - Creates GitHub release with installers
   - Takes ~15 minutes

## 📄 License

MIT License - see [LICENSE](zig-april-captions-ui/LICENSE) for details

Copyright (c) 2025 Minh Cong Tran

## 🙏 Acknowledgments

- [April ASR](https://github.com/abb128/april-asr) - Speech recognition engine
- [LiveCaptions](https://github.com/abb128/LiveCaptions) - Reference implementation
- [Tauri](https://tauri.app/) - Desktop app framework
- [Google Gemini API](https://ai.google.dev/) - AI features

---

<div align="center">

**[Download](https://github.com/minhtranin/zigy/releases/latest)** • **[Report Bug](https://github.com/minhtranin/zigy/issues)** • **[Documentation](zig-april-captions-ui/README.md)**

Made with ❤️ by Minh Cong Tran

</div>
