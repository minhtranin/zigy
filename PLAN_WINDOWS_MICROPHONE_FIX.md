# Plan: Fix Windows Microphone Access Error (DeviceEnumFailed)

## Problem Analysis

**Error**: `error.deviceEnumFailed` when clicking Start on Windows

**Root Cause**: The error occurs in `wasapi.zig:158` when `CoCreateInstance` fails to create the MMDeviceEnumerator COM object. This is typically caused by:

1. **Windows Privacy Settings** - Microphone access is blocked at the OS level
2. **COM Security/Permissions** - Application doesn't have necessary COM permissions
3. **Windows Audio Service** - Audio service is not running
4. **Missing Runtime Dependencies** - ONNX Runtime or VC++ Redistributable issues

## Location of Issue

- **File**: `zig-april-captions/src/wasapi.zig`
- **Line**: 157-158
- **Error Code**: `WasapiError.DeviceEnumFailed`

## Proposed Solution - Multi-Layered Approach

### 1. Improve Error Messages (High Priority)

**Goal**: Provide actionable, user-friendly error messages instead of cryptic error codes.

**Changes Needed**:

#### A. Update `wasapi.zig` to provide detailed error information
```zig
// Current (line 157-159):
if (hr_enum != @as(HRESULT, @as(c_long, 0)) or device_enumerator == null) {
    return WasapiError.DeviceEnumFailed;
}

// Proposed:
if (hr_enum != @as(HRESULT, @as(c_long, 0))) {
    // Log the specific HRESULT for debugging
    std.log.err("CoCreateInstance failed with HRESULT: 0x{x:0>8}", .{@as(u32, @bitCast(hr_enum))});

    // Map common HRESULT errors to specific error types
    return switch (@as(u32, @bitCast(hr_enum))) {
        0x80070005 => WasapiError.AccessDenied,      // E_ACCESSDENIED
        0x80040154 => WasapiError.ComNotRegistered,  // REGDB_E_CLASSNOTREG
        0x800401F0 => WasapiError.ComNotAvailable,   // CO_E_NOTINITIALIZED
        else => WasapiError.DeviceEnumFailed,
    };
}
```

#### B. Add new error types to `WasapiError` enum
```zig
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
    // New errors:
    AccessDenied,           // Windows privacy settings blocking access
    ComNotRegistered,       // COM component not registered
    ComNotAvailable,        // COM not initialized
    AudioServiceNotRunning, // Windows Audio service stopped
};
```

#### C. Update `main.rs` Tauri command to map errors to user-friendly messages
```rust
// In src-tauri/src/main.rs or lib.rs
fn map_wasapi_error(err: &str) -> String {
    if err.contains("DeviceEnumFailed") {
        "Microphone access failed. Please check:\n\
         1. Windows Privacy Settings → Microphone → Allow desktop apps\n\
         2. Windows Audio service is running\n\
         3. Restart the application as administrator (if needed)".to_string()
    } else if err.contains("AccessDenied") {
        "Access Denied: Please enable microphone permissions in Windows Settings → Privacy → Microphone".to_string()
    } else if err.contains("DeviceNotFound") {
        "No microphone found. Please connect a microphone and try again.".to_string()
    } else if err.contains("ComNotRegistered") || err.contains("ComNotAvailable") {
        "Windows audio system error. Please restart the Windows Audio service:\n\
         1. Press Win+R\n\
         2. Type 'services.msc'\n\
         3. Find 'Windows Audio'\n\
         4. Right-click → Restart".to_string()
    } else {
        format!("Failed to start: {}", err)
    }
}

// Update start_captions command to use mapped errors
#[tauri::command]
async fn start_captions(...) -> Result<(), String> {
    // ... existing code ...
    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(map_wasapi_error(&e.to_string()))
    }
}
```

#### D. Update UI to show structured error messages
```typescript
// In useCaptions.ts - line 295-298
catch (e) {
    const errorMsg = String(e);

    // Check if it's a permission error
    if (errorMsg.includes('Privacy') || errorMsg.includes('permission')) {
        setError('🔒 ' + errorMsg);
    } else if (errorMsg.includes('service')) {
        setError('⚙️ ' + errorMsg);
    } else {
        setError(`❌ ${errorMsg}`);
    }

    setIsLoading(false);
}
```

### 2. Add Documentation & Troubleshooting (High Priority)

**Update Installation documentation** to include Windows-specific microphone permissions:

#### A. Add to English translations (`docs/src/i18n/translations/en.ts`):
```typescript
'installation.troubleshooting.windows.mic.title': 'Windows: Microphone access denied',
'installation.troubleshooting.windows.mic.description': 'If you see "error.deviceEnumFailed", enable microphone permissions:',
'installation.troubleshooting.windows.mic.step1': 'Open Windows Settings (Win + I)',
'installation.troubleshooting.windows.mic.step2': 'Go to Privacy & Security → Microphone',
'installation.troubleshooting.windows.mic.step3': 'Enable "Let desktop apps access your microphone"',
'installation.troubleshooting.windows.mic.step4': 'Restart Zigy',
'installation.troubleshooting.windows.audio.title': 'Windows: Audio service not running',
'installation.troubleshooting.windows.audio.step1': 'Press Win + R, type "services.msc"',
'installation.troubleshooting.windows.audio.step2': 'Find "Windows Audio" service',
'installation.troubleshooting.windows.audio.step3': 'Right-click → Restart',
```

#### B. Add to Vietnamese translations (`docs/src/i18n/translations/vi.ts`):
```typescript
'installation.troubleshooting.windows.mic.title': 'Windows: Quyền truy cập microphone bị từ chối',
'installation.troubleshooting.windows.mic.description': 'Nếu bạn thấy "error.deviceEnumFailed", hãy bật quyền microphone:',
'installation.troubleshooting.windows.mic.step1': 'Mở Windows Settings (Win + I)',
'installation.troubleshooting.windows.mic.step2': 'Vào Privacy & Security → Microphone',
'installation.troubleshooting.windows.mic.step3': 'Bật "Let desktop apps access your microphone"',
'installation.troubleshooting.windows.mic.step4': 'Khởi động lại Zigy',
'installation.troubleshooting.windows.audio.title': 'Windows: Dịch vụ âm thanh không chạy',
'installation.troubleshooting.windows.audio.step1': 'Nhấn Win + R, gõ "services.msc"',
'installation.troubleshooting.windows.audio.step2': 'Tìm dịch vụ "Windows Audio"',
'installation.troubleshooting.windows.audio.step3': 'Nhấp chuột phải → Restart',
```

#### C. Update `Installation.astro` to add Windows troubleshooting section:
```astro
<div class="troubleshooting-item">
  <h4>{t('installation.troubleshooting.windows.mic.title')}</h4>
  <p>{t('installation.troubleshooting.windows.mic.description')}</p>
  <ol>
    <li>{t('installation.troubleshooting.windows.mic.step1')}</li>
    <li>{t('installation.troubleshooting.windows.mic.step2')}</li>
    <li>{t('installation.troubleshooting.windows.mic.step3')}</li>
    <li>{t('installation.troubleshooting.windows.mic.step4')}</li>
  </ol>
</div>

<div class="troubleshooting-item">
  <h4>{t('installation.troubleshooting.windows.audio.title')}</h4>
  <ol>
    <li>{t('installation.troubleshooting.windows.audio.step1')}</li>
    <li>{t('installation.troubleshooting.windows.audio.step2')}</li>
    <li>{t('installation.troubleshooting.windows.audio.step3')}</li>
  </ol>
</div>
```

### 3. Add Proactive Permission Check (Medium Priority)

**Goal**: Check for microphone permissions BEFORE attempting to start.

#### A. Add a Tauri command to check permissions:
```rust
#[tauri::command]
async fn check_microphone_permissions() -> Result<bool, String> {
    // Try to enumerate audio devices without actually starting capture
    // Return true if accessible, false otherwise
    // This is a lightweight check
}
```

#### B. Update UI to check permissions on app start:
```typescript
useEffect(() => {
    const checkPermissions = async () => {
        try {
            const hasPermission = await invoke('check_microphone_permissions');
            if (!hasPermission) {
                setError('⚠️ Microphone access not available. Please check Windows Privacy Settings.');
            }
        } catch (e) {
            console.warn('Could not check microphone permissions:', e);
        }
    };

    checkPermissions();
}, []);
```

### 4. Add In-App Help Dialog (Low Priority)

**Goal**: Show a help dialog when DeviceEnumFailed occurs.

#### A. Create a HelpDialog component with step-by-step visual guide
#### B. Trigger it automatically when microphone error occurs
#### C. Include screenshots or GIFs showing how to enable permissions

## Implementation Priority

### Phase 1 (Immediate - Documentation):
1. ✅ Add troubleshooting docs for Windows microphone permissions
2. ✅ Add to both English and Vietnamese translations
3. ✅ Update Installation.astro component

### Phase 2 (Next - Better Error Messages):
1. Update wasapi.zig to capture HRESULT codes
2. Add new error variants to WasapiError
3. Update Tauri command error mapping
4. Improve UI error display with icons and formatting

### Phase 3 (Future - Proactive Checks):
1. Add permission check command
2. Show warnings before start attempt
3. Add in-app help dialog with visual guides

## Testing Plan

1. **Test on Windows 10 with microphone disabled**:
   - Settings → Privacy → Microphone → OFF
   - Expected: Clear error message guiding to enable it

2. **Test with Windows Audio service stopped**:
   - Stop "Windows Audio" service
   - Expected: Service-related error message

3. **Test with no microphone connected**:
   - Expected: "No microphone found" message

4. **Test with microphone enabled (normal case)**:
   - Expected: Works correctly

## Files to Modify

1. `zig-april-captions/src/wasapi.zig` - Add detailed HRESULT logging
2. `zig-april-captions-ui/src-tauri/src/lib.rs` or `main.rs` - Add error mapping
3. `zig-april-captions-ui/src/hooks/useCaptions.ts` - Improve error display
4. `docs/src/i18n/translations/en.ts` - Add Windows troubleshooting keys
5. `docs/src/i18n/translations/vi.ts` - Add Vietnamese translations
6. `docs/src/components/Installation.astro` - Add troubleshooting sections

## Success Criteria

✅ Users see clear, actionable error messages instead of "error.deviceEnumFailed"
✅ Documentation includes Windows microphone permission setup
✅ Users can self-diagnose and fix 90% of microphone issues
✅ Error messages are available in both English and Vietnamese
