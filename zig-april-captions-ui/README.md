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

Download the latest release for your platform from the [GitHub releases page](https://github.com/minhtranin/zigy/releases/latest)

---

## 📖 Installation Guide for Non-Technical Users

**New to installing apps?** No problem! Follow these simple steps:

👉 **[Click here for the Complete Installation Guide](#-quick-start-guide)** 👈

The guide includes:
- ✅ How to download Zipy for your computer (Windows, Mac, or Linux)
- ✅ Step-by-step installation with screenshots descriptions
- ✅ How to set up voice recognition (one-time, 5 minutes)
- ✅ Common problems and how to fix them

**Total time:** About 5-10 minutes for first-time setup.

---

## ✨ Features

- 🎤 **Real-time Speech Recognition** - Live transcription as you speak
- 💬 **AI-Powered Assistance** - Integrated Gemini AI for summaries, questions, and idea generation
- 🌐 **Multi-language Support** - Translate captions to multiple languages
- 🎨 **Simple Mode** - Minimalist view perfect for presentations and focused transcription
- 📝 **Context Optimization** - Smart conversation history compression with snapshot caching
- 🌓 **Dark Mode** - Comfortable viewing in any lighting condition
- 📋 **Timeline View** - Organized history of all summaries, questions, ideas, and greetings
- ⚙️ **Customizable Settings** - Adjust font size, language, AI model, and more

## 🚀 Quick Start Guide

**Total time:** ~5-10 minutes (includes one-time model download)

### Step 1: Download Zipy

Go to the [releases page](https://github.com/minhtranin/zigy/releases/latest) and download the installer for your system:

- **Windows** → `Zipy_x.x.x_x64-setup.exe`
- **macOS** (M1/M2/M3/M4) → `Zipy_x.x.x_aarch64.dmg`
- **Linux** (Ubuntu/Debian) → `zipy_x.x.x_amd64.deb`
- **Linux** (Other) → `zipy_x.x.x_amd64.AppImage`

### Step 2: Install

<details>
<summary><b>Windows Installation</b></summary>

1. Double-click the downloaded `.exe` file
2. If you see "Windows protected your PC":
   - Click **More info**
   - Click **Run anyway**
3. Follow the installation wizard
4. Launch Zipy from the Start Menu

⚠️ **Note:** Windows version includes the user interface only. Speech recognition is not available on Windows.

</details>

<details>
<summary><b>macOS Installation</b></summary>

1. Double-click the downloaded `.dmg` file
2. Drag the **Zipy** app to your **Applications** folder
3. Go to Applications and double-click **Zipy**
4. If you see "cannot be opened because the developer cannot be verified":
   - Right-click (or Control-click) on **Zipy**
   - Click **Open**
   - Click **Open** again in the dialog

✅ **Supported:** Apple Silicon only (M1, M2, M3, M4 chips)
❌ **Not supported:** Intel Macs

</details>

<details>
<summary><b>Linux Installation - Ubuntu/Debian (.deb)</b></summary>

1. Open Terminal
2. Navigate to your Downloads folder:
   ```bash
   cd ~/Downloads
   ```
3. Install the package:
   ```bash
   sudo dpkg -i zipy_0.1.0_amd64.deb
   ```
4. Launch from your applications menu or run:
   ```bash
   zipy
   ```

</details>

<details>
<summary><b>Linux Installation - AppImage (All Distributions)</b></summary>

1. Open Terminal
2. Navigate to your Downloads folder:
   ```bash
   cd ~/Downloads
   ```
3. Make the file executable:
   ```bash
   chmod +x zipy_0.1.0_amd64.AppImage
   ```
4. Run it:
   ```bash
   ./zipy_0.1.0_amd64.AppImage
   ```

</details>

### Step 3: Download Voice Recognition Model (One-time)

Zipy needs a voice model to recognize speech. This is a one-time download.

1. **Open this link:** https://april.sapples.net/
2. **Download the file:** `april-english-dev-01110_en.april` (322 MB)
3. **Save it** to an easy-to-find location:
   - Windows: `C:\Users\YourName\Documents\`
   - macOS: `/Users/YourName/Documents/`
   - Linux: `/home/yourname/Documents/`

💡 **Tip:** Remember where you save this file - you'll need to select it in the next step.

### Step 4: First Launch Setup

1. **Open Zipy** (if not already open)
2. Click the **Settings** icon (⚙️ gear icon in the top-right corner)
3. Find the **"ASR Model"** section
4. Click the **"Browse"** button
5. Navigate to where you saved `april-english-dev-01110_en.april`
6. Select the file and click **Open**
7. Click **"Save"** at the bottom of Settings

✅ **You're done!** This model will be remembered for all future sessions.

### Step 5: Start Using Zipy

1. Click the **"Start"** button
2. Start speaking - your words will appear in real-time!
3. Use the **AI Assistant** to:
   - Get summaries of your conversation
   - Ask questions about what you said
   - Generate ideas from your discussions

---

## 🔧 Troubleshooting

<details>
<summary><b>macOS: "Zipy cannot be opened"</b></summary>

This is normal for apps downloaded from the internet.

**Solution:**
1. Don't double-click the app
2. Right-click (or Control-click) on Zipy
3. Select **Open**
4. Click **Open** in the confirmation dialog

</details>

<details>
<summary><b>Windows: "Windows protected your PC"</b></summary>

This happens because the app is not code-signed (signing costs money for open-source projects).

**Solution:**
1. Click **More info**
2. Click **Run anyway**

The app is safe - you can review the [source code](https://github.com/minhtranin/zigy).

</details>

<details>
<summary><b>Linux: AppImage won't run</b></summary>

You need to make the file executable first.

**Solution:**
```bash
chmod +x zipy_0.1.0_amd64.AppImage
./zipy_0.1.0_amd64.AppImage
```

</details>

<details>
<summary><b>"Please select a model file first"</b></summary>

You haven't set up the voice recognition model yet.

**Solution:**
1. Download the model from https://april.sapples.net/ (`april-english-dev-01110_en.april`)
2. In Zipy, go to Settings (⚙️)
3. Click Browse next to "ASR Model"
4. Select the downloaded `.april` file
5. Click Save

</details>

<details>
<summary><b>Speech recognition not working on Windows</b></summary>

Speech recognition is not available on Windows because the required audio library (PulseAudio) is not available for Windows.

**Windows version includes:**
- ✅ User interface
- ✅ AI Assistant features
- ✅ Text export
- ❌ Real-time speech recognition

For full features, use Linux or macOS.

</details>

---

## 🌍 Other Languages

Want to use Zipy with other languages? Download different models from the [April ASR models page](https://github.com/abb128/april-asr#models).

---

## 👨‍💻 For Developers: Build from Source

See the [Development](#-development) section below.

## 🛠️ Development

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **Rust** 1.94+ ([Install](https://rustup.rs/))
- **Zig** nightly ([Install](https://ziglang.org/download/))
- **Tauri CLI** v2 (installed via npm)
- **ONNX Runtime** (for speech recognition) - see [April ASR setup](https://github.com/abb128/april-asr#setup)

### Setup

```bash
# Clone the repository
git clone https://github.com/minhtranin/zigy.git
cd zigy

# Build the Zig speech recognition engine (optional for dev)
# Skip this if you only want to test the UI
cd zig-april-captions
zig build -Doptimize=ReleaseFast
# Copy binary to UI resources for testing
cp zig-out/bin/zig-april-captions ../zig-april-captions-ui/src-tauri/resources/
cd ../zig-april-captions-ui

# Install UI dependencies
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

### Notes

- **Dev mode without Zig binary**: If you skip building zig-april-captions, the app will fail to start captions but UI development still works
- **CI/CD automation**: GitHub Actions automatically builds zig-april-captions for all platforms during release

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
   - Go to `https://github.com/minhtranin/zigy/actions`
   - Monitor the "Release" workflow (takes ~10-15 minutes)
   - Download and test installers

### Build Artifacts

After a successful release, you'll find:

**Linux:**
- `zipy_0.1.0_amd64.deb` - Debian package
- `zipy_0.1.0_amd64.AppImage` - Portable Linux app

**macOS:**
- `Zipy_0.1.0_aarch64.dmg` - Apple Silicon installer

**Windows:**
- `Zipy_0.1.0_x64_en-US.msi` - Windows installer
- `Zipy_0.1.0_x64-setup.exe` - Setup executable

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
