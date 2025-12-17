# Zipy - Real-time Speech-to-Text Desktop App

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)](#download)

This repository contains the complete Zipy project - a real-time speech-to-text captions desktop application built with Tauri, React, TypeScript, and Zig.

## 📦 Repository Structure

This is a monorepo containing two main components:

```
zipy/
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

Get the latest release from [GitHub Releases](https://github.com/minhtranin/zipy/releases/latest)

**Available platforms:**
- Linux: `.deb` and `AppImage`
- macOS: Apple Silicon (M1/M2/M3) and Intel
- Windows: `.exe` installer

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
git clone https://github.com/minhtranin/zipy.git
cd zipy

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

See detailed setup instructions in `zig-april-captions-ui/README.md`

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

**[Download](https://github.com/minhtranin/zipy/releases/latest)** • **[Report Bug](https://github.com/minhtranin/zipy/issues)** • **[Documentation](zig-april-captions-ui/README.md)**

Made with ❤️ by Minh Cong Tran

</div>
