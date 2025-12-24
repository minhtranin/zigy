//! WASAPI audio capture for Windows
//! References:
//! - Microsoft WASAPI documentation
//! - LiveCaptions audiocap-pa.c for design patterns

const std = @import("std");

const c = @cImport({
    @cInclude("windows.h");
    @cInclude("mmdeviceapi.h");
    @cInclude("audioclient.h");
    @cInclude("initguid.h");
    @cDefine("CINTERFACE", "");
    @cDefine("COBJMACROS", "");
});

pub const WasapiError = error{
    DeviceEnumFailed,
    DeviceNotFound,
    ActivateFailed,
    FormatMismatch,
    InitializeFailed,
    GetBufferSizeFailed,
    StartFailed,
    GetServiceFailed,
    ReadFailed,
    BufferError,
};

/// Audio source type
pub const AudioSource = enum {
    microphone, // Capture from microphone
    monitor, // Capture system audio (loopback)
};

/// Audio format specification
pub const AudioFormat = struct {
    sample_rate: u32,
    channels: u8 = 1, // Mono for speech recognition
    bits_per_sample: u16 = 16, // 16-bit signed
};

/// Convert AudioFormat to WAVEFORMATEX
fn toWaveFormatEx(format: AudioFormat) c.WAVEFORMATEX {
    return .{
        .wFormatTag = c.WAVE_FORMAT_PCM,
        .nChannels = format.channels,
        .nSamplesPerSec = format.sample_rate,
        .nAvgBytesPerSec = format.sample_rate * format.channels * format.bits_per_sample / 8,
        .nBlockAlign = @as(c_short, @intCast(format.channels * format.bits_per_sample / 8)),
        .wBitsPerSample = format.bits_per_sample,
        .cbSize = 0,
    };
}

/// WASAPI audio capture
pub const AudioCapture = struct {
    device: ?*c.IMMDevice,
    audio_client: ?*c.IAudioClient,
    capture_client: ?*c.IAudioCaptureClient,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    event_handle: c.HANDLE,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(sample_rate: u32, source: AudioSource) WasapiError!Self {
        const format = AudioFormat{
            .sample_rate = sample_rate,
            .channels = 1,
            .bits_per_sample = 16,
        };

        // Initialize COM
        const hr = c.CoInitializeEx(null, c.COINIT_MULTITHREADED);
        if (hr != c.S_OK and hr != c.RPC_E_CHANGED_MODE) {
            std.log.err("COM initialization failed: 0x{x}", .{hr});
            return WasapiError.DeviceEnumFailed;
        }
        _ = c.CoInitializeEx(null, c.COINIT_MULTITHREADED);

        // Get device enumerator
        var device_enumerator: ?*c.IMMDeviceEnumerator = null;
        const hr_enum = c.CoCreateInstance(
            &c.CLSID_MMDeviceEnumerator,
            null,
            c.CLSCTX_ALL,
            &c.IID_IMMDeviceEnumerator,
            @ptrCast(&device_enumerator),
        );
        if (hr_enum != c.S_OK) {
            std.log.err("Device enumerator creation failed: 0x{x}", .{hr_enum});
            return WasapiError.DeviceEnumFailed;
        }

        // Get the appropriate device based on source
        var device: ?*c.IMMDevice = null;
        const hr_device = switch (source) {
            .microphone => c.IMMDeviceEnumerator_GetDefaultAudioEndpoint(
                device_enumerator.?,
                c.eCapture,
                c.eConsole,
                &device,
            ),
            .monitor => blk: {
                // For loopback, we use the output device
                const hr_loop = c.IMMDeviceEnumerator_GetDefaultAudioEndpoint(
                    device_enumerator.?,
                    c.eRender,
                    c.eConsole,
                    &device,
                );
                break :blk hr_loop;
            },
        };

        if (hr_device != c.S_OK or device == null) {
            std.log.err("Failed to get audio device: 0x{x}", .{hr_device});
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.DeviceNotFound;
        }

        // Activate audio client
        var audio_client: ?*c.IAudioClient = null;
        const hr_activate = c.IMMDevice_Activate(
            device.?,
            &c.IID_IAudioClient,
            c.CLSCTX_ALL,
            null,
            @ptrCast(&audio_client),
        );
        if (hr_activate != c.S_OK or audio_client == null) {
            std.log.err("Failed to activate audio client: 0x{x}", .{hr_activate});
            c.IMMDevice_Release(device);
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.ActivateFailed;
        }

        // Get the mix format and try to set our desired format
        var mix_format: *c.WAVEFORMATEX = undefined;
        const hr_format = c.IAudioClient_GetMixFormat(audio_client.?, &mix_format);
        _ = hr_format;

        // Set up our desired format (16-bit mono at requested sample rate)
        var wave_format = toWaveFormatEx(format);

        // For loopback, we need to use the mix format
        const hr_init = if (source == .monitor)
            c.IAudioClient_Initialize(
                audio_client.?,
                c.AUDCLNT_SHAREMODE_SHARED,
                c.AUDCLNT_STREAMFLAGS_LOOPBACK,
                10000000, // 1 second buffer in 100ns units
                0,
                mix_format,
                null,
            )
        else
            c.IAudioClient_Initialize(
                audio_client.?,
                c.AUDCLNT_SHAREMODE_SHARED,
                0,
                10000000, // 1 second buffer
                0,
                &wave_format,
                null,
            );

        if (hr_init != c.S_OK) {
            std.log.err("Failed to initialize audio client: 0x{x}", .{hr_init});
            c.IAudioClient_Release(audio_client);
            c.IMMDevice_Release(device);
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.InitializeFailed;
        }

        // Get capture client
        var capture_client: ?*c.IAudioCaptureClient = null;
        const hr_service = c.IAudioClient_GetService(
            audio_client.?,
            &c.IID_IAudioCaptureClient,
            @ptrCast(&capture_client),
        );
        if (hr_service != c.S_OK or capture_client == null) {
            std.log.err("Failed to get capture client: 0x{x}", .{hr_service});
            c.IAudioClient_Release(audio_client);
            c.IMMDevice_Release(device);
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.GetServiceFailed;
        }

        // Create event handle for synchronization
        const event_handle = c.CreateEventA(null, 0, 0, null);
        if (event_handle == null) {
            std.log.err("Failed to create event handle", .{});
            c.IAudioCaptureClient_Release(capture_client);
            c.IAudioClient_Release(audio_client);
            c.IMMDevice_Release(device);
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.InitializeFailed;
        }

        // Set the event handle
        const hr_set_event = c.IAudioClient_SetEventHandle(audio_client.?, event_handle);
        _ = hr_set_event;

        // Start recording
        const hr_start = c.IAudioClient_Start(audio_client.?);
        if (hr_start != c.S_OK) {
            std.log.err("Failed to start audio client: 0x{x}", .{hr_start});
            c.CloseHandle(event_handle);
            c.IAudioCaptureClient_Release(capture_client);
            c.IAudioClient_Release(audio_client);
            c.IMMDevice_Release(device);
            c.IMMDeviceEnumerator_Release(device_enumerator);
            return WasapiError.StartFailed;
        }

        return Self{
            .device = device,
            .audio_client = audio_client,
            .capture_client = capture_client,
            .format = format,
            .source = source,
            .running = std.atomic.Value(bool).init(true),
            .event_handle = event_handle,
        };
    }

    /// Read audio samples
    pub fn read(self: *Self, buffer: []i16) WasapiError![]i16 {
        if (!self.running.load(.acquire)) {
            return buffer[0..0];
        }

        const bytes_to_read = buffer.len * @sizeOf(i16);
        var bytes_read: usize = 0;

        // Wait for audio data
        const wait_result = c.WaitForSingleObject(self.event_handle, 1000);
        if (wait_result != c.WAIT_OBJECT_0) {
            // Timeout or error - return what we have or empty
            return buffer[0..0];
        }

        while (bytes_read < bytes_to_read) {
            var packet_length: u32 = 0;
            const hr_next = c.IAudioCaptureClient_GetNextPacketSize(self.capture_client.?, &packet_length);
            if (hr_next != c.S_OK) {
                return WasapiError.ReadFailed;
            }

            if (packet_length == 0) break;

            var data: [*]u8 = undefined;
            var num_frames: u32 = 0;
            var flags: u32 = 0;

            const hr_buffer = c.IAudioCaptureClient_GetBuffer(
                self.capture_client.?,
                @ptrCast(&data),
                &num_frames,
                &flags,
                null,
                null,
            );

            if (hr_buffer != c.S_OK) {
                if (hr_buffer == c.AUDCLNT_E_BUFFER_ERROR) {
                    break;
                }
                return WasapiError.BufferError;
            }

            // Copy data to buffer
            const available_bytes = num_frames * @as(usize, 2); // 16-bit = 2 bytes per sample
            const remaining = bytes_to_read - bytes_read;
            const to_copy = @min(available_bytes, remaining);

            const dest_start = bytes_read / 2;
            const copy_samples = to_copy / 2;
            const src_data = @as([*]i16, @ptrCast(data))[0..copy_samples];
            @memcpy(buffer[dest_start..][0..copy_samples], src_data);

            bytes_read += to_copy;

            const hr_release = c.IAudioCaptureClient_ReleaseBuffer(self.capture_client.?, num_frames);
            if (hr_release != c.S_OK) {
                return WasapiError.BufferError;
            }

            if (bytes_read >= bytes_to_read) break;
        }

        return buffer[0 .. bytes_read / @sizeOf(i16)];
    }

    /// Stop capture
    pub fn stop(self: *Self) void {
        self.running.store(false, .release);
    }

    /// Check if still running
    pub fn isRunning(self: *Self) bool {
        return self.running.load(.acquire);
    }

    /// Get the sample rate
    pub fn getSampleRate(self: *Self) u32 {
        return self.format.sample_rate;
    }

    /// Get the audio source type
    pub fn getSource(self: *Self) AudioSource {
        return self.source;
    }

    /// Clean up resources
    pub fn deinit(self: *Self) void {
        self.running.store(false, .release);

        if (self.audio_client) |ac| {
            _ = c.IAudioClient_Stop(ac);
        }

        if (self.capture_client) |cc| {
            c.IAudioCaptureClient_Release(cc);
        }

        if (self.audio_client) |ac| {
            c.IAudioClient_Release(ac);
        }

        if (self.device) |d| {
            c.IMMDevice_Release(d);
        }

        if (self.event_handle != null) {
            c.CloseHandle(self.event_handle);
        }
    }
};

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}
