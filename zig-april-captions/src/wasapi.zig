//! WASAPI audio capture for Windows
//! References:
//! - Microsoft WASAPI documentation
//! - LiveCaptions audiocap-pa.c for design patterns

const std = @import("std");

const windows = std.os.windows;
const HRESULT = windows.HRESULT;
const HANDLE = windows.HANDLE;
const kernel32 = std.os.windows.kernel32;

// Use WINAPI for COM methods (Stdcall on x86, C on x86_64)
const WINAPI = windows.WINAPI;

// COM CLSCTX constants (not available in std.os.windows)
const CLSCTX_INPROC_SERVER = 0x1;
const CLSCTX_INPROC_HANDLER = 0x2;
const CLSCTX_LOCAL_SERVER = 0x4;
const CLSCTX_REMOTE_SERVER = 0x10;
const CLSCTX_ALL = CLSCTX_INPROC_SERVER | CLSCTX_INPROC_HANDLER | CLSCTX_LOCAL_SERVER | CLSCTX_REMOTE_SERVER;

// COM functions from ole32
extern "ole32" fn CoInitializeEx(pvReserved: ?*anyopaque, dwCoInit: u32) callconv(WINAPI) HRESULT;
extern "ole32" fn CoCreateInstance(rclsid: *const windows.GUID, pUnkOuter: ?*anyopaque, dwClsContext: u32, riid: *const windows.GUID, ppv: *?*anyopaque) callconv(WINAPI) HRESULT;

// Kernel32 functions not in std.os.windows.kernel32
extern "kernel32" fn CreateEventA(lpEventAttributes: ?*anyopaque, bManualReset: i32, bInitialState: i32, lpName: ?[*:0]const u8) callconv(WINAPI) ?HANDLE;

// COM Interface GUIDs
const IID_IMMDeviceEnumerator = windows.GUID{ .Data1 = 0xa95664d2, .Data2 = 0x9614, .Data3 = 0x4f9f, .Data4 = .{ 0xb9, 0x3a, 0x6a, 0x93, 0x52, 0x49, 0x13, 0x04 } };
const CLSID_MMDeviceEnumerator = windows.GUID{ .Data1 = 0xbcde0395, .Data2 = 0xe52f, .Data3 = 0x467c, .Data4 = .{ 0x8e, 0x3d, 0xc6, 0x22, 0x34, 0xf4, 0x8c, 0x39 } };
const IID_IAudioClient = windows.GUID{ .Data1 = 0x1cb9ad4c, .Data2 = 0xdbfa, .Data3 = 0x4c11, .Data4 = .{ 0x81, 0xf1, 0xb7, 0x34, 0x73, 0x46, 0x41, 0x26 } };
const IID_IAudioCaptureClient = windows.GUID{ .Data1 = 0xc8adbd64, .Data2 = 0xe71e, .Data3 = 0x48a0, .Data4 = .{ 0xa8, 0x4b, 0xe6, 0x44, 0x59, 0x4c, 0xc9, 0x62 } };

// WASAPI constants
const AUDCLNT_SHAREMODE_SHARED = 0x00000001;
const AUDCLNT_STREAMFLAGS_LOOPBACK = 0x00020000;
const AUDCLNT_BUFFER_ERROR = 0x00800000;

// WaitForSingleObject return values
const WAIT_OBJECT_0 = 0x00000000;
const WAIT_TIMEOUT = 0x00000102;

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
    NullHandle,
};

/// Audio source type
pub const AudioSource = enum {
    microphone,
    monitor,
};

/// Audio format specification
pub const AudioFormat = struct {
    sample_rate: u32,
    channels: u8 = 1,
    bits_per_sample: u16 = 16,
};

/// WAVEFORMATEX structure
const WAVEFORMATEX = extern struct {
    wFormatTag: u16,
    nChannels: u16,
    nSamplesPerSec: u32,
    nAvgBytesPerSec: u32,
    nBlockAlign: u16,
    wBitsPerSample: u16,
    cbSize: u16,
};

// COM vtable definitions
const IMMDeviceEnumeratorVtbl = extern struct {
    QueryInterface: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
    AddRef: *const fn(*anyopaque) callconv(WINAPI) u32,
    Release: *const fn(*anyopaque) callconv(WINAPI) u32,
    GetDefaultAudioEndpoint: *const fn(*anyopaque, i32, i32, *?*anyopaque) callconv(WINAPI) HRESULT,
};

const IMMDeviceVtbl = extern struct {
    QueryInterface: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
    AddRef: *const fn(*anyopaque) callconv(WINAPI) u32,
    Release: *const fn(*anyopaque) callconv(WINAPI) u32,
    Activate: *const fn(*anyopaque, *const windows.GUID, u32, ?*anyopaque, *?*anyopaque) callconv(WINAPI) HRESULT,
};

const IAudioClientVtbl = extern struct {
    QueryInterface: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
    AddRef: *const fn(*anyopaque) callconv(WINAPI) u32,
    Release: *const fn(*anyopaque) callconv(WINAPI) u32,
    Initialize: *const fn(*anyopaque, u32, u64, u64, u64, *const WAVEFORMATEX, ?*const windows.GUID) callconv(WINAPI) HRESULT,
    GetBufferSize: *const fn(*anyopaque, *u32) callconv(WINAPI) HRESULT,
    GetStreamLatency: *const fn(*anyopaque, *i64) callconv(WINAPI) HRESULT,
    GetCurrentPadding: *const fn(*anyopaque, *u32) callconv(WINAPI) HRESULT,
    IsFormatSupported: *const fn(*anyopaque, u32, *const WAVEFORMATEX, *?*WAVEFORMATEX) callconv(WINAPI) HRESULT,
    GetMixFormat: *const fn(*anyopaque, *?*WAVEFORMATEX) callconv(WINAPI) HRESULT,
    GetDevicePeriod: *const fn(*anyopaque, ?*i64, ?*i64) callconv(WINAPI) HRESULT,
    Start: *const fn(*anyopaque) callconv(WINAPI) HRESULT,
    Stop: *const fn(*anyopaque) callconv(WINAPI) HRESULT,
    Reset: *const fn(*anyopaque) callconv(WINAPI) HRESULT,
    SetEventHandle: *const fn(*anyopaque, HANDLE) callconv(WINAPI) HRESULT,
    GetService: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
};

const IAudioCaptureClientVtbl = extern struct {
    QueryInterface: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
    AddRef: *const fn(*anyopaque) callconv(WINAPI) u32,
    Release: *const fn(*anyopaque) callconv(WINAPI) u32,
    GetBuffer: *const fn(*anyopaque, *[*]u8, *u32, *u32, ?*u64, ?*u64) callconv(WINAPI) HRESULT,
    ReleaseBuffer: *const fn(*anyopaque, u32) callconv(WINAPI) HRESULT,
    GetNextPacketSize: *const fn(*anyopaque, *u32) callconv(WINAPI) HRESULT,
};

/// WASAPI audio capture
pub const AudioCapture = struct {
    device: ?*anyopaque,
    audio_client: ?*anyopaque,
    capture_client: ?*anyopaque,
    format: AudioFormat,
    source: AudioSource,
    running: std.atomic.Value(bool),
    event_handle: ?HANDLE,

    const Self = @This();

    /// Initialize audio capture
    pub fn init(sample_rate: u32, source: AudioSource) WasapiError!Self {
        const format = AudioFormat{
            .sample_rate = sample_rate,
            .channels = 1,
            .bits_per_sample = 16,
        };

        // Initialize COM
        _ = CoInitializeEx(null, 0); // COINIT_MULTITHREADED = 0

        // Get device enumerator
        var device_enumerator: ?*anyopaque = null;
        const hr_enum = CoCreateInstance(
            &CLSID_MMDeviceEnumerator,
            null,
            CLSCTX_ALL,
            &IID_IMMDeviceEnumerator,
            @ptrCast(&device_enumerator),
        );
        if (hr_enum != @as(HRESULT, @as(c_long, 0)) or device_enumerator == null) {
            return WasapiError.DeviceEnumFailed;
        }

        // Get the appropriate device based on source
        var device: ?*anyopaque = null;
        const data_flow: i32 = if (source == .microphone) 1 else 0; // eCapture = 1, eRender = 0

        // Call GetDefaultAudioEndpoint through vtable
        const vtable_enum_ptr = @as(*const *IMMDeviceEnumeratorVtbl, @alignCast(@ptrCast(device_enumerator.?)));
        const vtable_enum = vtable_enum_ptr.*;
        const GetDefaultAudioEndpoint_fn = vtable_enum.GetDefaultAudioEndpoint;
        const hr_device = GetDefaultAudioEndpoint_fn(device_enumerator.?, data_flow, 1, &device);

        if (hr_device != @as(HRESULT, @as(c_long, 0)) or device == null) {
            _ = release(device_enumerator);
            return WasapiError.DeviceNotFound;
        }

        // Activate audio client
        var audio_client: ?*anyopaque = null;
        const vtable_device_ptr = @as(*const *IMMDeviceVtbl, @alignCast(@ptrCast(device.?)));
        const vtable_device = vtable_device_ptr.*;
        const Activate_fn = vtable_device.Activate;
        const hr_activate = Activate_fn(device.?, &IID_IAudioClient, CLSCTX_ALL, null, @ptrCast(&audio_client));

        if (hr_activate != @as(HRESULT, @as(c_long, 0)) or audio_client == null) {
            _ = release(device);
            _ = release(device_enumerator);
            return WasapiError.ActivateFailed;
        }

        // Set up our desired format (16-bit mono at requested sample rate)
        var wave_format = WAVEFORMATEX{
            .wFormatTag = 1, // WAVE_FORMAT_PCM
            .nChannels = format.channels,
            .nSamplesPerSec = format.sample_rate,
            .nAvgBytesPerSec = format.sample_rate * format.channels * format.bits_per_sample / 8,
            .nBlockAlign = @intCast(format.channels * format.bits_per_sample / 8),
            .wBitsPerSample = format.bits_per_sample,
            .cbSize = 0,
        };

        // Initialize audio client
        const vtable_audio_ptr = @as(*const *IAudioClientVtbl, @alignCast(@ptrCast(audio_client.?)));
        const vtable_audio = vtable_audio_ptr.*;
        const stream_flags: u64 = if (source == .monitor) AUDCLNT_STREAMFLAGS_LOOPBACK else 0;

        const Initialize_fn = vtable_audio.Initialize;
        const hr_init = Initialize_fn(
            audio_client.?,
            AUDCLNT_SHAREMODE_SHARED,
            stream_flags,
            10000000, // 1 second buffer in 100ns units
            0,
            &wave_format,
            null,
        );

        if (hr_init != @as(HRESULT, @as(c_long, 0))) {
            _ = release(audio_client);
            _ = release(device);
            _ = release(device_enumerator);
            return WasapiError.InitializeFailed;
        }

        // Get capture client
        var capture_client: ?*anyopaque = null;
        const GetService_fn = vtable_audio.GetService;
        const hr_service = GetService_fn(audio_client.?, &IID_IAudioCaptureClient, @ptrCast(&capture_client));

        if (hr_service != @as(HRESULT, @as(c_long, 0))) {
            _ = release(audio_client);
            _ = release(device);
            _ = release(device_enumerator);
            return WasapiError.GetServiceFailed;
        }

        if (capture_client == null) {
            _ = release(audio_client);
            _ = release(device);
            _ = release(device_enumerator);
            return WasapiError.GetServiceFailed;
        }

        // Create event handle for synchronization
        const event_handle = CreateEventA(null, 0, 0, null);
        if (event_handle == null) {
            _ = release(capture_client);
            _ = release(audio_client);
            _ = release(device);
            _ = release(device_enumerator);
            return WasapiError.InitializeFailed;
        }

        // Set the event handle
        const SetEventHandle_fn = vtable_audio.SetEventHandle;
        _ = SetEventHandle_fn(audio_client.?, event_handle.?);

        // Start recording
        const Start_fn = vtable_audio.Start;
        const hr_start = Start_fn(audio_client.?);
        if (hr_start != @as(HRESULT, @as(c_long, 0))) {
            _ = windows.kernel32.CloseHandle(event_handle);
            _ = release(capture_client);
            _ = release(audio_client);
            _ = release(device);
            _ = release(device_enumerator);
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
        const wait_result = windows.kernel32.WaitForSingleObject(self.event_handle orelse return error.NullHandle, 1000);
        if (wait_result != WAIT_OBJECT_0) {
            return buffer[0..0];
        }

        const vtable_capture_ptr = @as(*const *IAudioCaptureClientVtbl, @alignCast(@ptrCast(self.capture_client.?)));
        const vtable_capture = vtable_capture_ptr.*;

        while (bytes_read < bytes_to_read) {
            var packet_length: u32 = 0;
            const GetNextPacketSize_fn = vtable_capture.GetNextPacketSize;
            const hr_next = GetNextPacketSize_fn(self.capture_client.?, &packet_length);
            if (hr_next != @as(HRESULT, @as(c_long, 0))) {
                return WasapiError.ReadFailed;
            }

            if (packet_length == 0) break;

            var data: [*]u8 = undefined;
            var num_frames: u32 = 0;
            var flags: u32 = 0;

            const GetBuffer_fn = vtable_capture.GetBuffer;
            const hr_buffer = GetBuffer_fn(
                self.capture_client.?,
                &data,
                &num_frames,
                &flags,
                null,
                null,
            );

            if (hr_buffer != @as(HRESULT, @as(c_long, 0))) {
                // Check for buffer error - compare as integers
                const hr_code: c_ulong = @bitCast(hr_buffer);
                if (hr_code == AUDCLNT_BUFFER_ERROR) {
                    break;
                }
                return WasapiError.BufferError;
            }

            // Copy data to buffer
            const available_bytes = num_frames * 2;
            const remaining = bytes_to_read - bytes_read;
            const to_copy = @min(available_bytes, remaining);

            const dest_start = bytes_read / 2;
            const copy_samples = to_copy / 2;
            const src_data = @as([*]i16, @ptrCast(@alignCast(data)))[0..copy_samples];
            @memcpy(buffer[dest_start..][0..copy_samples], src_data);

            bytes_read += to_copy;

            const ReleaseBuffer_fn = vtable_capture.ReleaseBuffer;
            const hr_release = ReleaseBuffer_fn(self.capture_client.?, num_frames);
            if (hr_release != @as(HRESULT, @as(c_long, 0))) {
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
            const vtable_ptr = @as(*const *IAudioClientVtbl, @alignCast(@ptrCast(ac)));
            const vtable = vtable_ptr.*;
            const Stop_fn = vtable.Stop;
            _ = Stop_fn(ac);
        }

        if (self.capture_client) |cc| {
            _ = release(cc);
        }

        if (self.audio_client) |ac| {
            _ = release(ac);
        }

        if (self.device) |d| {
            _ = release(d);
        }

        if (self.event_handle) |h| {
            _ = windows.kernel32.CloseHandle(h);
        }
    }
};

// Generic COM vtable for Release (common to all COM objects)
const GenericCOMVtbl = extern struct {
    QueryInterface: *const fn(*anyopaque, *const windows.GUID, *?*anyopaque) callconv(WINAPI) HRESULT,
    AddRef: *const fn(*anyopaque) callconv(WINAPI) u32,
    Release: *const fn(*anyopaque) callconv(WINAPI) u32,
};

/// Helper function to release COM objects
fn release(obj: ?*anyopaque) u32 {
    if (obj) |o| {
        const vtable_ptr = @as(*const *GenericCOMVtbl, @alignCast(@ptrCast(o)));
        const vtable = vtable_ptr.*;
        return vtable.Release(o);
    }
    return 0;
}

/// Calculate number of samples for a given duration in milliseconds
pub fn samplesForMs(sample_rate: u32, ms: u32) usize {
    return @as(usize, sample_rate) * ms / 1000;
}
