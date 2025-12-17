# zig-april-captions

Real-time speech-to-text captioning tool written in Zig. Captures audio from microphone or system audio (YouTube, videos, etc.) and displays live captions in the terminal.

Based on [LiveCaptions](https://github.com/abb128/LiveCaptions) architecture, using [April ASR](https://github.com/abb128/april-asr) for local speech recognition.

## Features

- Real-time speech-to-text transcription
- Microphone input support
- System audio capture (for YouTube, videos, meetings, etc.)
- 100% local processing - no cloud services, no data sent anywhere
- Low latency (~50ms audio chunks)
- Partial results shown in gray, final results in white

## Requirements

- Linux with PulseAudio
- Zig 0.13.0+
- ONNX Runtime v1.14.1

## Quick Start

### 1. Install Zig

```bash
wget https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz
tar xf zig-linux-x86_64-0.13.0.tar.xz
mv zig-linux-x86_64-0.13.0 ~/zig
export PATH="$HOME/zig:$PATH"
```

### 2. Install ONNX Runtime

```bash
cd /tmp
wget https://github.com/microsoft/onnxruntime/releases/download/v1.14.1/onnxruntime-linux-x64-1.14.1.tgz
tar xzf onnxruntime-linux-x64-1.14.1.tgz
mv onnxruntime-linux-x64-1.14.1 ~/onnxruntime
```

### 3. Install PulseAudio dev libraries

```bash
# Debian/Ubuntu
sudo apt install libpulse-dev

# Fedora
sudo dnf install pulseaudio-libs-devel

# Arch
sudo pacman -S libpulse
```

### 4. Download April ASR Model

```bash
mkdir -p models
cd models
wget https://april.sapples.net/april-english-dev-01110_en.april
```

### 5. Build

```bash
zig build

# Or build optimized release
zig build -Doptimize=ReleaseFast
```

### 6. Run

```bash
# From microphone
./zig-out/bin/zig-april-captions models/april-english-dev-01110_en.april

# From system audio (YouTube, videos, etc.)
./zig-out/bin/zig-april-captions --monitor models/april-english-dev-01110_en.april
```

## Usage

```
zig-april-captions - Real-time speech-to-text

Usage: zig-april-captions [options] <model.april>

Arguments:
  model.april       Path to April ASR model file

Options:
  -m, --monitor     Capture system audio (YouTube, videos, etc.)
      --mic         Capture from microphone (default)
  -h, --help        Show this help message
  -v, --version     Show version

Examples:
  zig-april-captions model.april                    # From microphone
  zig-april-captions --monitor model.april          # From system audio
```

## Project Structure

```
zig-april-captions/
├── build.zig           # Build configuration (compiles April ASR from source)
├── src/
│   ├── main.zig        # Entry point, CLI argument parsing
│   ├── april.zig       # April ASR C bindings
│   ├── pulse.zig       # PulseAudio audio capture
│   └── processor.zig   # ASR processing and silence detection
├── libs/
│   └── april-asr/      # April ASR library (git submodule)
└── models/
    └── *.april         # Speech recognition models
```

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│ Audio Source    │────▶│ PulseAudio   │────▶│ ASR         │
│ (Mic/Monitor)   │     │ (50ms chunks)│     │ Processor   │
└─────────────────┘     └──────────────┘     └──────┬──────┘
                                                    │
                         ┌──────────────────────────┘
                         ▼
                  ┌─────────────┐     ┌─────────────┐
                  │ April ASR   │────▶│ Terminal    │
                  │ (ONNX)      │     │ Output      │
                  └─────────────┘     └─────────────┘
```

1. **Audio Capture**: PulseAudio captures audio in 50ms chunks from microphone or system monitor
2. **Silence Detection**: Detects silence to know when to flush results
3. **Speech Recognition**: April ASR processes audio using ONNX Runtime
4. **Display**: Partial results (gray) and final results (white) shown in terminal

## Configuration

The build system looks for ONNX Runtime in:
1. `$ONNX_ROOT` environment variable
2. `~/onnxruntime/` (default)

You can set custom paths:
```bash
export ONNX_ROOT=/path/to/onnxruntime
zig build
```

## Models

Download models from [April ASR Models](https://github.com/abb128/april-asr#models):

| Model | Size | Description |
|-------|------|-------------|
| april-english-dev-01110_en.april | 322MB | English (US) - Recommended |

## Troubleshooting

### "Failed to open System Audio"
- Make sure audio is playing before starting the app
- Check PulseAudio is running: `pulseaudio --check`

### "ASR can't keep up with audio"
- Your CPU may be too slow for real-time processing
- Try using a smaller model or optimized build: `zig build -Doptimize=ReleaseFast`

### No output when speaking
- Check microphone permissions
- Verify microphone works: `parecord test.wav` then `paplay test.wav`

## References

- [LiveCaptions](https://github.com/abb128/LiveCaptions) - Original C implementation
- [April ASR](https://github.com/abb128/april-asr) - Speech recognition library
- [ONNX Runtime](https://github.com/microsoft/onnxruntime) - ML inference engine

## License

MIT
