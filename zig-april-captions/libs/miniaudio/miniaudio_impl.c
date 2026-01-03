// miniaudio implementation file
// This compiles the miniaudio library

#define MINIAUDIO_IMPLEMENTATION

// Use only what we need - capture only
#define MA_NO_DECODING
#define MA_NO_ENCODING
#define MA_NO_GENERATION
#define MA_NO_ENGINE
#define MA_NO_NODE_GRAPH

// On Linux, prefer PulseAudio over ALSA for better compatibility
// (PulseAudio handles device switching, volume control, etc.)
#ifdef __linux__
#define MA_ENABLE_PULSEAUDIO
#define MA_ENABLE_ALSA
#endif

// On macOS, use CoreAudio
#ifdef __APPLE__
#define MA_ENABLE_COREAUDIO
#endif

// On Windows, use WASAPI
#ifdef _WIN32
#define MA_ENABLE_WASAPI
#endif

#include "miniaudio.h"
