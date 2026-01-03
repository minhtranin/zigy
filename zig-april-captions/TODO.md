# TODO - Performance Testing & Optimization

## Platform Audio Performance Comparison

### Test Checklist (macOS vs Linux)

**Test Setup:**
- [ ] Play YouTube English podcast on both platforms
- [ ] Measure time-to-first-caption (from audio start to first text)
- [ ] Monitor for any lag or stutter during continuous playback
- [ ] Check CPU usage during transcription

**Metrics to Compare:**
- [ ] Initial latency (time to first caption)
- [ ] Caption update frequency
- [ ] CPU usage percentage
- [ ] Memory usage
- [ ] Any stuttering or dropped audio

---

## Potential Optimizations (if macOS is slower)

### Buffer Size Tuning
- [ ] Reduce buffer size from 50ms to 25ms (lower latency)
- [ ] Test with 40ms, 30ms, 20ms buffers
- [ ] Find sweet spot between latency and CPU

### Ring Buffer Size
- [ ] Current: 2 seconds (32000 samples @ 16kHz)
- [ ] Consider reducing to 1 second if memory is concern
- [ ] Monitor for buffer overruns/underruns

### AudioQueue Configuration
- [ ] Test different buffer counts (currently 3)
- [ ] Monitor callback processing time
- [ ] Check for any AudioQueue-specific optimizations

---

## Known Limitations

### macOS AudioQueue
- Only supports microphone capture (not system audio/loopback)
- For system audio capture on macOS, users would need:
  - Core Audio taps API (macOS 14.2+ only)
  - BlackHole virtual audio device
  - SoundFlower alternative

### Linux PulseAudio
- Supports both microphone and monitor (system audio) via `@DEFAULT_MONITOR@`
- Works on all PulseAudio distributions

---

## Version Info
- **v1.0.8** - AudioQueue Services implementation for macOS
- Commit: b3f6bf9
