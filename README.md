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

**Never installed software from GitHub before?** No worries! Follow the detailed guide below.

<details open>
<summary><b>📥 Step 1: Download Zipy (Click to expand)</b></summary>

<br>

**Where to download:**
1. Go to our [**Releases Page**](https://github.com/minhtranin/zigy/releases/latest)
2. Scroll down to the **"Assets"** section at the bottom
3. Choose the file for your operating system:

| Your Computer | File to Download | Size |
|---------------|-----------------|------|
| 🪟 Windows 10/11 | `Zipy_0.1.0_x64-setup.exe` | ~35 MB |
| 🍎 Mac with Apple Silicon (M1/M2/M3/M4) | `Zipy_0.1.0_aarch64.dmg` | ~25 MB |
| 🐧 Linux Ubuntu/Debian | `zipy_0.1.0_amd64.deb` | ~30 MB |
| 🐧 Linux (Other distros) | `zipy_0.1.0_amd64.AppImage` | ~30 MB |

**Don't know which one?**
- Windows: Look at your Start menu - if you have Windows 10 or 11, get the `.exe` file
- Mac: Click the Apple logo → About This Mac → If it says "M1", "M2", "M3", or "M4", get the `.dmg` file
- Linux: If you use Ubuntu or Linux Mint, get the `.deb` file. Otherwise, get the `.AppImage` file

⚠️ **Important:** Windows version does NOT include speech recognition (Windows doesn't support the audio library we use). You'll get the UI and AI features only.

</details>

<details>
<summary><b>💿 Step 2: Install Zipy (Click to expand)</b></summary>

<br>

### Windows Installation

1. **Find the downloaded file:**
   - Open File Explorer
   - Go to your Downloads folder (`C:\Users\YourName\Downloads\`)
   - Look for `Zipy_0.1.0_x64-setup.exe`

2. **Run the installer:**
   - Double-click the file
   - You'll see "Windows protected your PC" - this is normal!
   - Click **"More info"**
   - Click **"Run anyway"**

3. **Follow the wizard:**
   - Click "Next" through the installation steps
   - Choose installation location (or keep default)
   - Click "Install"

4. **Launch Zipy:**
   - Find "Zipy" in your Start Menu
   - Click to open

---

### macOS Installation

1. **Open the downloaded file:**
   - Go to your Downloads folder
   - Double-click `Zipy_0.1.0_aarch64.dmg`
   - A window will open showing the Zipy icon

2. **Install to Applications:**
   - Drag the **Zipy** icon to the **Applications** folder
   - Wait for it to copy

3. **First launch (Important!):**
   - Go to your **Applications** folder
   - **Don't double-click Zipy yet!**
   - **Right-click** (or Control-click) on Zipy
   - Select **"Open"**
   - Click **"Open"** in the dialog that appears
   - This only needs to be done once!

4. **Next time:**
   - You can launch Zipy normally from Applications or Launchpad

**Why the extra steps?** macOS blocks apps from unidentified developers. Right-clicking lets you bypass this safely.

---

### Linux Installation (Ubuntu/Debian)

1. **Open Terminal:**
   - Press `Ctrl + Alt + T`
   - Or search for "Terminal" in your applications

2. **Go to Downloads:**
   ```bash
   cd ~/Downloads
   ```

3. **Install the package:**
   ```bash
   sudo dpkg -i zipy_0.1.0_amd64.deb
   ```
   - Enter your password when asked
   - Wait for installation to complete

4. **Launch Zipy:**
   - Search for "Zipy" in your application menu
   - Or run in terminal:
   ```bash
   zipy
   ```

---

### Linux Installation (AppImage - All Distros)

1. **Open Terminal:**
   - Press `Ctrl + Alt + T`

2. **Go to Downloads:**
   ```bash
   cd ~/Downloads
   ```

3. **Make it executable:**
   ```bash
   chmod +x zipy_0.1.0_amd64.AppImage
   ```

4. **Run it:**
   ```bash
   ./zipy_0.1.0_amd64.AppImage
   ```

**Optional:** To add it to your applications menu, right-click the AppImage → "Integrate and run"

</details>

<details>
<summary><b>🎤 Step 3: Download Voice Recognition Model (Click to expand)</b></summary>

<br>

**What is this?** The voice model is the "brain" that converts your speech to text. It's a one-time download.

**Why separate?** Keeping it separate:
- Makes the installer smaller (30 MB vs 350 MB)
- Lets you choose different languages
- Easier to update models independently

### Download Steps:

1. **Go to the model website:**
   - Open this link: **https://april.sapples.net/**

2. **Find the English model:**
   - Look for `april-english-dev-01110_en.april`
   - Click to download (322 MB)
   - Save time: 2-5 minutes depending on your internet

3. **Save it somewhere you'll remember:**
   - **Windows:** `C:\Users\YourName\Documents\`
   - **macOS:** `/Users/YourName/Documents/`
   - **Linux:** `/home/yourname/Documents/`

💡 **Tip:** Create a folder called "Zipy" in your Documents folder and save the model there!

**Want other languages?** Check out all available models at: https://github.com/abb128/april-asr#models

</details>

<details>
<summary><b>⚙️ Step 4: Connect the Voice Model to Zipy (Click to expand)</b></summary>

<br>

Now we need to tell Zipy where to find the voice model you downloaded.

### Setup Steps:

1. **Open Zipy** (if not already open)

2. **Open Settings:**
   - Look for the **gear icon (⚙️)** in the top-right corner
   - Click it

3. **Find the ASR Model section:**
   - Scroll down to "ASR Model"
   - You'll see a Browse button

4. **Select your model file:**
   - Click the **"Browse"** button
   - Navigate to where you saved the `.april` file:
     - Windows: Go to `C:\Users\YourName\Documents\`
     - macOS: Go to `/Users/YourName/Documents/`
     - Linux: Go to `/home/yourname/Documents/`
   - Click on `april-english-dev-01110_en.april`
   - Click **"Open"** or **"Select"**

5. **Save your settings:**
   - Scroll to the bottom of Settings
   - Click **"Save"**

✅ **You're all set!** Zipy will remember this model for all future sessions.

</details>

<details>
<summary><b>🎉 Step 5: Start Using Zipy (Click to expand)</b></summary>

<br>

### Your First Session:

1. **Start Speech Recognition:**
   - Click the big **"Start"** button
   - Zipy will begin listening to your microphone

2. **Test it out:**
   - Say something like "Hello, this is a test"
   - Your words should appear on screen in real-time!

3. **Use AI Features:**
   - Click **"Summary"** to get a summary of what you said
   - Click **"Question"** to ask questions about the conversation
   - Click **"Ideas"** to generate ideas from your discussion

4. **Adjust Settings:**
   - Change font size for better visibility
   - Switch to dark mode
   - Try Simple Mode for presentations
   - Change language for translation

### Troubleshooting:

**Not hearing anything?**
- Check Settings → Make sure the correct microphone is selected
- Speak clearly and at normal volume
- Make sure your microphone is not muted

**Words not appearing?**
- Check that the model file is loaded in Settings
- Make sure you clicked "Start"
- Try speaking more clearly

**Want to export your text?**
- Click the Timeline view
- Right-click on any entry to copy or export

</details>

---

### ⚡ Quick Install Summary (For Experienced Users)

Already familiar with GitHub releases? Here's the quick version:

```bash
# 1. Download installer from releases
https://github.com/minhtranin/zigy/releases/latest

# 2. Install Zipy (platform-specific)

# 3. Download voice model (322 MB)
https://april.sapples.net/
# → april-english-dev-01110_en.april

# 4. Configure in app
Zipy → Settings ⚙️ → ASR Model → Browse → Select file → Save

# 5. Start using
Click "Start" → Speak!
```

## 🏗️ Project Architecture

This repository contains **two main components** that work together:

<details>
<summary><b>📁 Component 1: zig-april-captions (Speech Recognition Engine)</b></summary>

<br>

**Location:** `/zig-april-captions/`

### What it does:
- Captures audio from your microphone in real-time
- Converts speech to text using AI models
- Outputs transcriptions as JSON data

### Technology Stack:
- **Language:** Zig (fast, system-level language)
- **Audio Capture:** PulseAudio (Linux/macOS only)
- **Speech Recognition:** April ASR library
- **AI Runtime:** ONNX Runtime (runs .april model files)

### How it works:
1. Listens to your default microphone
2. Processes audio in real-time chunks
3. Runs the audio through the April ASR model
4. Sends transcribed text to the UI application

### Platform Support:
- ✅ Linux (full support)
- ✅ macOS (full support)
- ❌ Windows (PulseAudio not available)

**For developers:** See [zig-april-captions/README.md](zig-april-captions/README.md) for build instructions.

</details>

<details>
<summary><b>📁 Component 2: zig-april-captions-ui (Desktop Application)</b></summary>

<br>

**Location:** `/zig-april-captions-ui/`

### What it does:
- Provides the graphical user interface
- Displays real-time captions
- Offers AI-powered features (summary, Q&A, ideas)
- Manages settings and preferences
- Exports transcriptions

### Technology Stack:
- **Frontend Framework:** React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Desktop Framework:** Tauri v2 (Rust)
- **AI Integration:** Google Gemini API
- **Build Tool:** Vite

### Features:
- 🎨 **Simple Mode:** Minimalist view for presentations
- 🌓 **Dark/Light Theme:** Comfortable viewing
- 🌍 **Multi-language:** Translation support
- 💾 **Export:** Save conversations as text
- 📊 **Timeline:** History of AI interactions
- ⚙️ **Settings:** Customizable preferences

### How it works:
1. User clicks "Start"
2. App launches zig-april-captions binary as subprocess
3. Receives JSON transcription stream
4. Displays captions in real-time
5. Provides AI features on demand

**For developers:** See [zig-april-captions-ui/README.md](zig-april-captions-ui/README.md) for development setup.

</details>

<details>
<summary><b>🔗 How Components Work Together</b></summary>

<br>

```
┌─────────────────────────────────────────────┐
│  User Interface (Tauri + React)            │
│  - Display captions                         │
│  - Settings, AI features                    │
│  - Timeline, export                         │
└──────────────┬──────────────────────────────┘
               │ Spawns as subprocess
               ▼
┌─────────────────────────────────────────────┐
│  Speech Engine (Zig Binary)                │
│  - Capture microphone audio                 │
│  - Run April ASR model                      │
│  - Output JSON transcriptions               │
└──────────────┬──────────────────────────────┘
               │ Reads from
               ▼
┌─────────────────────────────────────────────┐
│  Voice Model (.april file)                  │
│  - Neural network weights                   │
│  - Language-specific model                  │
│  - Downloaded separately (322 MB)           │
└─────────────────────────────────────────────┘
```

**Communication Flow:**
1. UI app starts speech engine with model path as argument
2. Speech engine streams JSON to stdout
3. UI app reads JSON and updates display
4. User can stop/start speech engine on demand

</details>

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>Why is the Windows version missing speech recognition?</b></summary>

<br>

The speech recognition engine (`zig-april-captions`) requires **PulseAudio**, an audio system available on Linux and macOS but not on Windows.

**What works on Windows:**
- ✅ User interface
- ✅ AI features (summary, Q&A, ideas)
- ✅ Settings and customization
- ✅ Timeline view
- ❌ Real-time speech-to-text

**Alternatives for Windows users:**
- Use Windows Subsystem for Linux (WSL2) with PulseAudio
- Run in a Linux virtual machine
- Use Linux or macOS for full functionality

</details>

<details>
<summary><b>Can I use Zipy offline?</b></summary>

<br>

**Speech Recognition:** ✅ Yes! 100% offline
- The April ASR model runs locally on your computer
- No internet required for transcription
- Your audio never leaves your device

**AI Features:** ❌ No, requires internet
- Summary, Q&A, and Ideas use Google Gemini API
- Requires active internet connection
- Requires API key in settings

**Best of both worlds:**
- Use speech recognition offline anytime
- Connect to internet only when you want AI features

</details>

<details>
<summary><b>Which languages are supported?</b></summary>

<br>

**Speech Recognition Languages:**
The default model supports **English only**. Other languages available:
- Visit https://github.com/abb128/april-asr#models
- Download language-specific `.april` models
- Load in Settings → ASR Model

**Available models:**
- English (default)
- More languages available from April ASR project

**Translation Feature:**
Once transcribed, you can translate captions to many languages using the built-in translation feature (requires internet).

</details>

<details>
<summary><b>How accurate is the speech recognition?</b></summary>

<br>

Accuracy depends on several factors:

**Good accuracy (90%+):**
- Clear speech, minimal background noise
- Standard accents
- Good microphone quality
- Normal speaking pace

**Lower accuracy:**
- Heavy accents or dialects
- Noisy environments
- Low-quality microphones
- Very fast or mumbled speech

**Tips for best results:**
- Use a good quality microphone
- Speak clearly and at normal pace
- Minimize background noise
- Position mic 6-12 inches from mouth

The April ASR model is continuously improving - newer models provide better accuracy.

</details>

<details>
<summary><b>Is my audio data sent to the cloud?</b></summary>

<br>

**Short answer:** No for speech recognition, yes for AI features.

**Speech Recognition (Offline):**
- ✅ 100% local processing
- ✅ Audio never leaves your device
- ✅ Model runs on your computer
- ✅ Complete privacy

**AI Features (Online):**
- ⚠️ Transcribed text (not audio) sent to Google Gemini API
- ⚠️ Only when you click Summary/Question/Ideas
- ⚠️ Requires API key (you control usage)
- ⚠️ Subject to Google's privacy policy

**Privacy-conscious users:**
- Use speech recognition without AI features
- Your transcriptions stay 100% local
- Export and use your own AI tools if preferred

</details>

<details>
<summary><b>Can I contribute to this project?</b></summary>

<br>

**Yes!** We welcome contributions. Here's how:

**Report Bugs:**
- Open an issue: https://github.com/minhtranin/zigy/issues
- Describe the problem clearly
- Include steps to reproduce
- Mention your OS and version

**Suggest Features:**
- Open a feature request issue
- Explain the use case
- Describe expected behavior

**Submit Code:**
- Fork the repository
- Create a feature branch
- Make your changes
- Submit a pull request

**Improve Documentation:**
- Fix typos or unclear sections
- Add examples
- Translate to other languages

See the [Development](#-quick-start-for-developers) section below for setup instructions.

</details>

<details>
<summary><b>Where are my settings and data stored?</b></summary>

<br>

**Settings file location:**
- **Linux:** `~/.config/zipy/settings.json`
- **macOS:** `~/Library/Application Support/zipy/settings.json`
- **Windows:** `C:\Users\YourName\AppData\Roaming\zipy\settings.json`

**What's stored:**
- Model file path
- Audio source preference
- Font size, theme, language
- Gemini API key (if configured)
- Timeline history

**Data privacy:**
- Everything stored locally on your device
- No automatic cloud sync
- You can delete settings.json to reset

</details>

---

## 🔧 Common Issues & Solutions

<details>
<summary><b>❌ "Please select a model file first"</b></summary>

<br>

**Problem:** You haven't configured the voice model yet.

**Solution:**
1. Download the model: https://april.sapples.net/ → `april-english-dev-01110_en.april`
2. Open Zipy → Settings (⚙️)
3. Click "Browse" next to ASR Model
4. Navigate to and select the `.april` file
5. Click "Save"

</details>

<details>
<summary><b>❌ Microphone not working / No audio detected</b></summary>

<br>

**Check these:**

1. **Microphone permissions:**
   - macOS: System Preferences → Security & Privacy → Microphone → Enable Zipy
   - Linux: Check if PulseAudio is running: `pulseaudio --check`

2. **Correct input device:**
   - Open Settings → Check Audio Source
   - Select your microphone from dropdown

3. **Microphone not muted:**
   - Check physical mute button on mic
   - Check system audio settings
   - Test mic in other apps first

4. **Volume levels:**
   - Ensure mic volume is not too low
   - Check system input levels

</details>

<details>
<summary><b>❌ App won't start on macOS</b></summary>

<br>

**"Zipy cannot be opened because the developer cannot be verified"**

**Solution:**
1. Don't double-click the app
2. Right-click (Control-click) on Zipy
3. Select "Open"
4. Click "Open" in the dialog
5. This only needs to be done once

**Alternative:**
- System Preferences → Security & Privacy → General
- Click "Open Anyway" next to the message about Zipy

</details>

<details>
<summary><b>❌ Windows: "Windows protected your PC"</b></summary>

<br>

**Why this happens:**
The app is not code-signed because code signing certificates cost money for open-source projects.

**Solution:**
1. Click "More info"
2. Click "Run anyway"
3. The app is safe - you can review the source code

**Still concerned?**
- Build from source yourself (see Developer section)
- Review the code: https://github.com/minhtranin/zigy

</details>

<details>
<summary><b>❌ Linux: AppImage permission denied</b></summary>

<br>

**Problem:** AppImage file is not executable.

**Solution:**
```bash
cd ~/Downloads
chmod +x zipy_0.1.0_amd64.AppImage
./zipy_0.1.0_amd64.AppImage
```

</details>

<details>
<summary><b>❌ AI features not working</b></summary>

<br>

**Possible causes:**

1. **No internet connection**
   - AI features require internet
   - Check your network connection

2. **No API key configured**
   - Get a free key: https://ai.google.dev/
   - Settings → AI Configuration → Enter API key

3. **API quota exceeded**
   - Check your Google AI Studio quota
   - Wait for quota reset or upgrade plan

4. **No transcribed text**
   - AI features need text to work with
   - Speak first, then use AI features

</details>

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
