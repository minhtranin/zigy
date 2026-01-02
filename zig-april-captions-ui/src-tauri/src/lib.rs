use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use rusqlite::params;

// ============================================================================
// macOS Microphone Permission Request
// ============================================================================
// On macOS, we must request microphone permission from the MAIN app bundle
// BEFORE spawning the child process (zig-april-captions). Otherwise, the
// child process will fail to access audio devices because:
// 1. macOS TCC (Transparency, Consent, Control) grants permissions per-bundle
// 2. Ad-hoc signed child processes don't trigger permission dialogs
// 3. The parent app must request permission first for child to inherit access
// ============================================================================

#[cfg(target_os = "macos")]
mod macos_permissions {
    use objc::runtime::{Class, Object, BOOL};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Condvar, Mutex};
    use std::time::Duration;

    static PERMISSION_REQUESTED: AtomicBool = AtomicBool::new(false);

    /// Request microphone permission on macOS using AVCaptureDevice.
    /// This triggers the system permission dialog if not already granted.
    /// Returns true if permission is granted, false otherwise.
    pub fn request_microphone_permission() -> bool {
        println!("=== macOS Microphone Permission Check ===");

        unsafe {
            // Get AVCaptureDevice class
            let av_capture_device = match Class::get("AVCaptureDevice") {
                Some(cls) => cls,
                None => {
                    println!("ERROR: AVCaptureDevice class not found");
                    return false;
                }
            };

            // Create NSString for "soun" (AVMediaTypeAudio FourCC)
            let ns_string = Class::get("NSString").expect("NSString not found");
            let audio_type: *const Object = msg_send![ns_string, stringWithUTF8String: b"soun\0".as_ptr()];

            // Check current authorization status
            // AVAuthorizationStatus: 0=NotDetermined, 1=Restricted, 2=Denied, 3=Authorized
            let status: i64 = msg_send![av_capture_device, authorizationStatusForMediaType: audio_type];
            println!("Current authorization status: {} (0=NotDetermined, 1=Restricted, 2=Denied, 3=Authorized)", status);

            match status {
                3 => {
                    // Already authorized
                    println!("Microphone permission already GRANTED");
                    return true;
                }
                1 => {
                    println!("Microphone access is RESTRICTED by system policy");
                    return false;
                }
                2 => {
                    println!("Microphone access was DENIED by user");
                    println!("User needs to grant permission in: System Settings > Privacy & Security > Microphone");
                    return false;
                }
                0 => {
                    // Not determined - need to request permission
                    if PERMISSION_REQUESTED.load(Ordering::SeqCst) {
                        println!("Permission already requested this session, checking status...");
                        let new_status: i64 = msg_send![av_capture_device, authorizationStatusForMediaType: audio_type];
                        return new_status == 3;
                    }

                    println!("Permission not determined, requesting access...");
                    PERMISSION_REQUESTED.store(true, Ordering::SeqCst);

                    // Use a synchronization primitive to wait for the callback
                    let result = Arc::new((Mutex::new(None::<bool>), Condvar::new()));
                    let result_clone = result.clone();

                    // Create the completion handler block
                    let handler = block::ConcreteBlock::new(move |granted: BOOL| {
                        println!("Permission callback received: granted = {}", granted);
                        let (lock, cvar) = &*result_clone;
                        let mut guard = lock.lock().unwrap();
                        *guard = Some(granted);
                        cvar.notify_one();
                    });

                    // Request access - this should trigger the permission dialog
                    let _: () = msg_send![av_capture_device, requestAccessForMediaType: audio_type completionHandler: handler.copy()];

                    println!("Permission dialog should appear now...");

                    // Wait for the callback with a timeout
                    let (lock, cvar) = &*result;
                    let guard = lock.lock().unwrap();
                    let wait_result = cvar.wait_timeout(guard, Duration::from_secs(30)).unwrap();

                    if let Some(granted) = *wait_result.0 {
                        println!("Permission request completed: {}", if granted { "GRANTED" } else { "DENIED" });
                        return granted;
                    } else {
                        println!("Permission request timed out, checking status...");
                        let new_status: i64 = msg_send![av_capture_device, authorizationStatusForMediaType: audio_type];
                        return new_status == 3;
                    }
                }
                _ => {
                    println!("Unknown authorization status: {}", status);
                    return false;
                }
            }
        }
    }

    /// Check if microphone permission is currently granted
    pub fn check_microphone_permission() -> bool {
        unsafe {
            let av_capture_device = match Class::get("AVCaptureDevice") {
                Some(cls) => cls,
                None => return false,
            };

            let ns_string = Class::get("NSString").expect("NSString not found");
            let audio_type: *const Object = msg_send![ns_string, stringWithUTF8String: b"soun\0".as_ptr()];

            let status: i64 = msg_send![av_capture_device, authorizationStatusForMediaType: audio_type];
            status == 3 // Authorized
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod macos_permissions {
    pub fn request_microphone_permission() -> bool {
        true // No-op on non-macOS platforms
    }

    pub fn check_microphone_permission() -> bool {
        true
    }
}

// Database module
mod database;
use database::{init_db, migrate_from_json, ChatHistoryEntry};

// Global state to manage the child process and transcript history
struct AppState {
    process: Mutex<Option<Child>>,
    settings: Mutex<Settings>,
    transcript_lines: Mutex<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AISettings {
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub translation_language: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub meeting_context: Option<String>,
}

fn default_model() -> String {
    "gemini-2.5-flash".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub model_path: String,
    pub audio_source: String, // "mic" or "monitor"
    pub font_size: u32,
    pub theme: String, // "light" or "dark"
    #[serde(default = "default_language")]
    pub language: String, // "en" or "vi"
    #[serde(default)]
    pub ai: Option<AISettings>,
}

fn default_language() -> String {
    "en".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            audio_source: "mic".to_string(),
            font_size: 24,
            theme: "dark".to_string(),
            language: "en".to_string(),
            ai: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Caption {
    pub id: String,
    pub text: String,
    pub caption_type: String, // "partial" or "final"
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CaptionEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(rename = "captionType", default)]
    caption_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    timestamp: Option<i64>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    source: Option<String>,
}

fn get_settings_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

fn get_knowledge_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("knowledge.json")
}

fn get_ideas_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("ideas.json")
}

fn get_chat_history_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("chat_history.json")
}

fn get_context_snapshots_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("context_snapshots.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub content: String,
    pub created_at: i64,
    #[serde(default)]
    pub nominated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeaEntry {
    pub id: String,
    pub title: String,
    pub raw_content: String,
    pub corrected_script: String,
    pub created_at: i64,
}

// Context compression snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub id: String,
    pub created_at: i64,
    pub summary: String,           // Compressed summary of old context
    pub covered_until: i64,        // Timestamp of last message in summary
    pub original_token_count: i64, // Estimated tokens before compression
    pub compressed_token_count: i64, // Estimated tokens after compression
}

// ============================================================================
// BINARY SEARCH ORDER - CRITICAL FOR APPIMAGE/DEB BUNDLES
// ============================================================================
// IMPORTANT: The order of binary path checks is CRITICAL for bundled apps
// (AppImage, .deb, .app). The issue was that system paths like /usr/lib/zigy/
// were checked BEFORE Tauri's bundled resource path, causing the app to find
// system-installed binaries instead of bundled ones.
//
// FIXED ORDER (must maintain):
// 1. Dev mode paths (only in debug builds)
// 2. Relative paths to executable (for some bundle formats)
// 3. TAURI RESOURCE PATH FIRST (for AppImage/deb - resolves to
//    /tmp/.mount_XXX/usr/lib/Zigy/resources/ in AppImage)
// 4. System paths like /usr/lib/zigy/ (fallback ONLY)
//
// ISSUE HISTORY: GitHub Actions builds would create AppImage/deb where the
// bundled binary was at /usr/lib/Zigy/resources/zig-april-captions but the
// code checked /usr/lib/zigy/ first, so it found system-installed version
// instead of bundled one, causing "hang on start" issues.
//
// ALSO IMPORTANT: The binary needs LD_LIBRARY_PATH set to find
// libonnxruntime.so which is bundled in the same directory.
// ============================================================================
fn get_zig_binary_path(app_handle: &AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "zig-april-captions.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "zig-april-captions";

    // Get the current executable path as the base for all searches
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    println!("Executable path: {}", exe_path.display());
    println!("Executable parent: {}", exe_path.parent().unwrap_or_else(|| Path::new("")).display());

    // Check if we're in development mode (debug build)
    let is_dev_mode = exe_path.to_string_lossy().contains("/target/debug/") ||
                      exe_path.to_string_lossy().contains("\\target\\debug\\");

    // Dev mode: check local build first
    if is_dev_mode {
        println!("Running in development mode, checking dev builds first");

        // In the same parent directory (dev mode)
        let dev_candidates = vec![
            format!("../zig-april-captions/zig-out/bin/{}", binary_name),
            // Absolute path to user's build
            format!(
                "{}/workspace/local/zig/zig-april-captions/zig-out/bin/{}",
                dirs::home_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
                binary_name
            ),
        ];

        for candidate in &dev_candidates {
            println!("Checking dev path: {}", candidate);
            if Path::new(&candidate).exists() {
                println!("Found zig-april-captions at: {}", candidate);
                return Ok(candidate.to_string());
            }
        }
    }

    // Try multiple locations relative to the executable
    let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new(""));

    let candidates = vec![
        // Same directory as executable (common for AppImage, Windows)
        exe_dir.join(binary_name),
        // resources/ subdirectory next to executable
        exe_dir.join("resources").join(&binary_name),
        // ../resources/ (for some bundle formats)
        exe_dir.join("..").join("resources").join(&binary_name),
    ];

    for candidate in &candidates {
        println!("Checking: {}", candidate.display());
        if candidate.exists() {
            println!("Found zig-april-captions at: {}", candidate.display());
            return Ok(candidate.to_string_lossy().to_string());
        }
    }

    // Try Tauri's resource resolver FIRST (for AppImage and proper bundles)
    // This should be checked before system paths to prefer bundled binaries
    if let Ok(resource_dir) = app_handle
        .path()
        .resolve("", tauri::path::BaseDirectory::Resource)
    {
        println!("Tauri resource directory: {}", resource_dir.display());

        // Check multiple possible locations within the resource directory
        let resource_candidates = vec![
            resource_dir.join(&binary_name),                    // Direct in resource dir
            resource_dir.join("resources").join(&binary_name),  // In resources/ subdirectory
        ];

        for resource_path in resource_candidates {
            println!("Checking Tauri resource path: {}", resource_path.display());
            if resource_path.exists() {
                println!("Found zig-april-captions in Tauri resources at: {}", resource_path.display());

                #[cfg(unix)]
                {
                    // Make sure it's executable
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(metadata) = std::fs::metadata(&resource_path) {
                        let mode = metadata.permissions().mode();
                        println!("Binary permissions: {:o}", mode);
                        if mode & 0o111 == 0 {
                            println!("Binary is not executable, attempting to set +x");
                            let _ = std::fs::set_permissions(&resource_path, std::fs::Permissions::from_mode(mode | 0o111));
                        }
                    }
                }

                return Ok(resource_path.to_string_lossy().to_string());
            }
        }
    }

    // For Linux .deb packages: check /usr/lib/zigy/ (fallback for system installations)
    #[cfg(target_os = "linux")]
    {
        let deb_path = Path::new("/usr/lib/zigy").join(&binary_name);
        println!("Checking .deb installation path: {}", deb_path.display());
        if deb_path.exists() {
            println!("Found zig-april-captions at: {}", deb_path.display());

            // Make sure it's executable
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(&deb_path) {
                let mode = metadata.permissions().mode();
                println!("Binary permissions: {:o}", mode);
                if mode & 0o111 == 0 {
                    println!("Binary is not executable, attempting to set +x");
                    let _ = std::fs::set_permissions(&deb_path, std::fs::Permissions::from_mode(mode | 0o111));
                }
            }

            return Ok(deb_path.to_string_lossy().to_string());
        }
    }

    // For macOS app bundles: check Contents/Resources/ where Tauri bundles resources
    #[cfg(target_os = "macos")]
    {
        // Standard macOS .app bundle structure:
        // Zigy.app/Contents/MacOS/zig-april-captions-ui (main executable, exe_dir is here)
        // Zigy.app/Contents/Resources/zig-april-captions (bundled Zig binary)
        //
        // NOTE: Current bundle has nested resources/ directory due to tauri.conf.json config,
        // so we check Resources/resources/ first for compatibility with existing installations

        let app_bundle_candidates = vec![
            // FIRST: Check nested resources/ subdirectory (current bundle structure)
            exe_dir.join("..").join("Resources").join("resources").join(&binary_name),
            // SECOND: Standard location (future builds after bundle fix)
            exe_dir.join("..").join("Resources").join(&binary_name),
            // THIRD: Fallback - same directory as executable (edge case)
            exe_dir.join(&binary_name),
        ];

        for candidate in &app_bundle_candidates {
            println!("Checking macOS app bundle path: {}", candidate.display());
            if candidate.exists() {
                println!("Found zig-april-captions at: {}", candidate.display());
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
    }

    // Try in PATH as last resort
    println!("Warning: zig-april-captions not found in any location, trying system PATH");
    Ok(binary_name.to_string())
}

#[tauri::command]
async fn start_captions(
    app_handle: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    model_path: String,
    audio_source: String,
) -> Result<(), String> {
    // CRITICAL: Request microphone permission BEFORE spawning child process
    // On macOS, the main app bundle must request permission first, otherwise
    // the child process (zig-april-captions) will fail with "device not found"
    #[cfg(target_os = "macos")]
    {
        println!("Checking microphone permission before starting captions...");
        let has_permission = macos_permissions::request_microphone_permission();
        if !has_permission {
            return Err("Microphone permission not granted. Please allow microphone access in System Settings > Privacy & Security > Microphone, then restart Zigy.".to_string());
        }
        println!("Microphone permission granted, proceeding to start captions");
    }

    // Stop any existing process first
    stop_captions_internal(&state)?;

    let binary_path = get_zig_binary_path(&app_handle)?;

    // Build command arguments
    let mut args = vec!["--json".to_string()];
    if audio_source == "monitor" {
        args.push("--monitor".to_string());
    }
    args.push(model_path.clone());

    println!("Starting: {} {:?}", binary_path, args);

    // Check if binary exists and is executable
    let binary_path_obj = Path::new(&binary_path);
    if !binary_path_obj.exists() {
        return Err(format!("Binary not found at path: {}", binary_path));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let metadata = std::fs::metadata(&binary_path)
            .map_err(|e| format!("Failed to get binary metadata: {}", e))?;
        let permissions = metadata.permissions();
        let mode = permissions.mode();
        println!("Binary permissions: {:o}", mode);

        if mode & 0o111 == 0 {
            println!("Warning: Binary is not executable, attempting to set +x");
            std::fs::set_permissions(&binary_path, std::fs::Permissions::from_mode(mode | 0o111))
                .map_err(|e| format!("Failed to make binary executable: {}", e))?;
        }
    }

    // Spawn the process
    println!("Spawning process: {} {:?}", binary_path, args);

    // CRITICAL: Set LD_LIBRARY_PATH to include the binary's directory
    // The zig-april-captions binary depends on libonnxruntime.so which is
    // bundled in the same directory. Without this, the binary fails to find
    // the library and crashes on startup. This is especially important for
    // AppImage/deb bundles where the binary's rpath may be incorrect.
    let binary_dir = binary_path_obj.parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut cmd = Command::new(&binary_path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Linux, set LD_LIBRARY_PATH so the binary can find libonnxruntime.so
    #[cfg(target_os = "linux")]
    {
        let current_ld_path = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
        let new_ld_path = if current_ld_path.is_empty() {
            binary_dir.clone()
        } else {
            format!("{}:{}", binary_dir, current_ld_path)
        };
        println!("Setting LD_LIBRARY_PATH: {}", new_ld_path);
        cmd.env("LD_LIBRARY_PATH", new_ld_path);
    }

    // On macOS, set DYLD_LIBRARY_PATH so the binary can find libonnxruntime.dylib
    #[cfg(target_os = "macos")]
    {
        let current_dyld_path = std::env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
        let new_dyld_path = if current_dyld_path.is_empty() {
            binary_dir.clone()
        } else {
            format!("{}:{}", binary_dir, current_dyld_path)
        };
        println!("Setting DYLD_LIBRARY_PATH: {}", new_dyld_path);
        cmd.env("DYLD_LIBRARY_PATH", new_dyld_path);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to start zig-april-captions at {}: {}", binary_path, e))?;

    println!("Process spawned successfully, PID: {:?}", child.id());

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // Store the process
    {
        let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
        *process_guard = Some(child);
    }

    // Spawn a thread to read stdout and emit events
    let app_handle_clone = app_handle.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(json_line) => {
                    if json_line.is_empty() {
                        continue;
                    }
                    println!("stdout: {}", json_line);
                    // Parse JSON and emit to frontend
                    match serde_json::from_str::<CaptionEvent>(&json_line) {
                        Ok(event) => {
                            let _ = app_handle_clone.emit("caption-event", event);
                        }
                        Err(e) => {
                            eprintln!("Failed to parse JSON: {} - line: {}", e, json_line);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error reading stdout: {}", e);
                    break;
                }
            }
        }
        // Process ended
        let _ = app_handle_clone.emit(
            "caption-event",
            CaptionEvent {
                event_type: "stopped".to_string(),
                caption_type: None,
                text: None,
                timestamp: None,
                message: None,
                version: None,
                source: None,
            },
        );
    });

    // Spawn a thread to read stderr for debugging
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(stderr_line) => {
                    if !stderr_line.is_empty() {
                        eprintln!("stderr: {}", stderr_line);
                    }
                }
                Err(e) => {
                    eprintln!("Error reading stderr: {}", e);
                    break;
                }
            }
        }
    });

    Ok(())
}

fn stop_captions_internal(state: &tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut process_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = process_guard.take() {
        // Try to kill gracefully first
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

#[tauri::command]
async fn stop_captions(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    stop_captions_internal(&state)
}

#[tauri::command]
async fn is_running(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    let process_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(_child) = process_guard.as_ref() {
        // Check if process is still running
        // Note: We can't easily check without consuming the child, so we assume it's running
        // The actual status is tracked via events
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, Arc<AppState>>) -> Result<Settings, String> {
    let settings_guard = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings_guard.clone())
}

#[tauri::command]
async fn save_settings(
    state: tauri::State<'_, Arc<AppState>>,
    settings: Settings,
) -> Result<(), String> {
    // Update in-memory settings
    {
        let mut settings_guard = state.settings.lock().map_err(|e| e.to_string())?;
        *settings_guard = settings.clone();
    }

    // Save to file
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn export_captions(captions: Vec<Caption>, file_path: String) -> Result<(), String> {
    let mut content = String::new();
    content.push_str("# Zigy Export\n\n");

    for caption in captions {
        if caption.caption_type == "final" {
            let time = chrono_lite_format(caption.timestamp);
            content.push_str(&format!("[{}] {}\n", time, caption.text));
        }
    }

    std::fs::write(&file_path, content).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

fn chrono_lite_format(timestamp_ms: i64) -> String {
    let secs = timestamp_ms / 1000;
    let hours = (secs / 3600) % 24;
    let mins = (secs / 60) % 60;
    let secs = secs % 60;
    format!("{:02}:{:02}:{:02}", hours, mins, secs)
}

#[tauri::command]
async fn select_model_file() -> Result<Option<String>, String> {
    // This will be handled by the frontend using tauri-plugin-dialog
    Ok(None)
}

/// Check if the zig-april-captions binary exists
#[tauri::command]
async fn check_binary_exists(app_handle: AppHandle) -> Result<bool, String> {
    let path = get_zig_binary_path(&app_handle)?;
    Ok(std::path::Path::new(&path).exists() || path == "zig-april-captions" || path == "zig-april-captions.exe")
}

/// Check and request microphone permission (macOS only)
/// Returns: { "status": "granted" | "denied" | "not_determined" | "restricted", "platform": "macos" | "other" }
#[tauri::command]
async fn check_microphone_permission() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        let has_permission = macos_permissions::request_microphone_permission();
        Ok(serde_json::json!({
            "status": if has_permission { "granted" } else { "denied" },
            "platform": "macos",
            "message": if has_permission {
                "Microphone permission granted"
            } else {
                "Microphone permission denied. Please grant access in System Settings > Privacy & Security > Microphone"
            }
        }))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(serde_json::json!({
            "status": "granted",
            "platform": "other",
            "message": "Microphone permission not required on this platform"
        }))
    }
}

#[tauri::command]
async fn get_binary_path(app_handle: AppHandle) -> Result<String, String> {
    get_zig_binary_path(&app_handle)
}

/// Get the path to the bundled April ASR model
#[tauri::command]
async fn get_bundled_model_path(app_handle: AppHandle) -> Result<Option<String>, String> {
    let model_name = "april-english-dev-01110_en.april";

    // Get the resource directory
    let resource_dir = app_handle
        .path()
        .resolve("", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // Check multiple possible locations for the bundled model
    let mut model_candidates = vec![
        resource_dir.join("resources").join(model_name),  // In resources/ subdirectory
        resource_dir.join(model_name),                   // Direct in resource dir
    ];

    #[cfg(target_os = "linux")]
    {
        // For .deb installations: check /usr/lib/zigy/resources/
        model_candidates.push(Path::new("/usr/lib/zigy/resources").join(model_name));
    }

    for model_path in model_candidates {
        if model_path.exists() {
            return Ok(Some(model_path.to_string_lossy().to_string()));
        }
    }

    // No bundled model found
    Ok(None)
}

#[tauri::command]
async fn get_binary_debug_info(app_handle: AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let binary_name = "zig-april-captions.exe";
    #[cfg(not(target_os = "windows"))]
    let binary_name = "zig-april-captions";

    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    let exe_dir = exe_path.parent().unwrap_or_else(|| Path::new(""));

    let mut debug_info = String::new();
    debug_info.push_str(&format!("=== Binary Debug Info ===\n"));
    debug_info.push_str(&format!("Current executable: {}\n", exe_path.display()));
    debug_info.push_str(&format!("Executable directory: {}\n", exe_dir.display()));
    debug_info.push_str(&format!("Looking for binary: {}\n\n", binary_name));

    debug_info.push_str("=== Candidate Paths ===\n");

    let candidates = vec![
        ("Same dir as exe", exe_dir.join(binary_name)),
        ("resources/ subdirectory", exe_dir.join("resources").join(&binary_name)),
        ("../resources/", exe_dir.join("..").join("resources").join(&binary_name)),
    ];

    for (desc, path) in &candidates {
        let exists = path.exists();
        debug_info.push_str(&format!("{}: {} [{}]\n", desc, path.display(), if exists { "FOUND" } else { "not found" }));
    }

    #[cfg(target_os = "linux")]
    {
        let deb_path = Path::new("/usr/lib/zigy").join(&binary_name);
        let exists = deb_path.exists();
        debug_info.push_str(&format!("Linux .deb path: {} [{}]\n", deb_path.display(), if exists { "FOUND" } else { "not found" }));
    }

    if let Ok(resource_path) = app_handle
        .path()
        .resolve(&binary_name, tauri::path::BaseDirectory::Resource)
    {
        let exists = resource_path.exists();
        debug_info.push_str(&format!("Tauri resource path: {} [{}]\n", resource_path.display(), if exists { "FOUND" } else { "not found" }));
    }

    // List directory contents of exe_dir
    debug_info.push_str("\n=== Contents of executable directory ===\n");
    if let Ok(entries) = std::fs::read_dir(exe_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().into_string().unwrap_or_default();
            debug_info.push_str(&format!("  {}\n", name));
        }
    }

    // List resources directory if it exists
    let resources_dir = exe_dir.join("resources");
    if resources_dir.exists() {
        debug_info.push_str("\n=== Contents of resources/ directory ===\n");
        if let Ok(entries) = std::fs::read_dir(&resources_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().into_string().unwrap_or_default();
                debug_info.push_str(&format!("  {}\n", name));
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let lib_dir = Path::new("/usr/lib/zigy");
        if lib_dir.exists() {
            debug_info.push_str("\n=== Contents of /usr/lib/zigy/ ===\n");
            if let Ok(entries) = std::fs::read_dir(lib_dir) {
                for entry in entries.flatten() {
                    let name = entry.file_name().into_string().unwrap_or_default();
                    debug_info.push_str(&format!("  {}\n", name));
                }
            }
        }
    }

    Ok(debug_info)
}

#[tauri::command]
async fn get_transcript(state: tauri::State<'_, Arc<AppState>>) -> Result<Vec<String>, String> {
    let lines = state.transcript_lines.lock().map_err(|e| e.to_string())?;
    Ok(lines.clone())
}

#[tauri::command]
async fn add_transcript_line(state: tauri::State<'_, Arc<AppState>>, line: String) -> Result<Vec<String>, String> {
    let mut lines = state.transcript_lines.lock().map_err(|e| e.to_string())?;
    lines.push(line);
    Ok(lines.clone())
}

#[tauri::command]
async fn clear_transcript(state: tauri::State<'_, Arc<AppState>>) -> Result<(), String> {
    let mut lines = state.transcript_lines.lock().map_err(|e| e.to_string())?;
    lines.clear();
    Ok(())
}

#[tauri::command]
async fn get_knowledge() -> Result<Vec<KnowledgeEntry>, String> {
    let path = get_knowledge_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let entries: Vec<KnowledgeEntry> = serde_json::from_str(&content).unwrap_or_default();
        Ok(entries)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn save_knowledge(entries: Vec<KnowledgeEntry>) -> Result<(), String> {
    let path = get_knowledge_path();
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save knowledge: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn add_knowledge_entry(content: String) -> Result<KnowledgeEntry, String> {
    let path = get_knowledge_path();
    let mut entries: Vec<KnowledgeEntry> = if path.exists() {
        let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        vec![]
    };

    let entry = KnowledgeEntry {
        id: uuid::Uuid::new_v4().to_string(),
        content,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        nominated: true, // Default to nominated when adding new entries
    };

    entries.push(entry.clone());

    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save knowledge: {}", e))?;

    Ok(entry)
}

#[tauri::command]
async fn delete_knowledge_entry(id: String) -> Result<(), String> {
    let path = get_knowledge_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut entries: Vec<KnowledgeEntry> = serde_json::from_str(&content).unwrap_or_default();
        entries.retain(|e| e.id != id);
        let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| format!("Failed to save knowledge: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn update_knowledge_entry(id: String, content: String) -> Result<KnowledgeEntry, String> {
    let path = get_knowledge_path();
    if !path.exists() {
        return Err("Knowledge file not found".to_string());
    }

    let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut entries: Vec<KnowledgeEntry> = serde_json::from_str(&file_content).unwrap_or_default();

    let entry = entries.iter_mut().find(|e| e.id == id);
    match entry {
        Some(e) => {
            e.content = content;
            let updated = e.clone();

            let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
            std::fs::write(&path, json).map_err(|e| format!("Failed to save knowledge: {}", e))?;

            Ok(updated)
        }
        None => Err("Knowledge entry not found".to_string()),
    }
}

#[tauri::command]
async fn toggle_knowledge_nomination(id: String) -> Result<KnowledgeEntry, String> {
    let path = get_knowledge_path();
    if !path.exists() {
        return Err("Knowledge file not found".to_string());
    }

    let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut entries: Vec<KnowledgeEntry> = serde_json::from_str(&file_content).unwrap_or_default();

    let entry = entries.iter_mut().find(|e| e.id == id);
    match entry {
        Some(e) => {
            e.nominated = !e.nominated;
            let updated = e.clone();

            let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
            std::fs::write(&path, json).map_err(|e| format!("Failed to save knowledge: {}", e))?;

            Ok(updated)
        }
        None => Err("Knowledge entry not found".to_string()),
    }
}

// Idea CRUD commands
#[tauri::command]
async fn get_ideas() -> Result<Vec<IdeaEntry>, String> {
    let path = get_ideas_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let entries: Vec<IdeaEntry> = serde_json::from_str(&content).unwrap_or_default();
        Ok(entries)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn add_idea(
    title: String,
    raw_content: String,
    corrected_script: String
) -> Result<IdeaEntry, String> {
    let path = get_ideas_path();
    let mut entries: Vec<IdeaEntry> = if path.exists() {
        let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        vec![]
    };

    let entry = IdeaEntry {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        raw_content,
        corrected_script,
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
    };

    entries.insert(0, entry.clone()); // Insert at beginning for newest first

    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save idea: {}", e))?;

    Ok(entry)
}

#[tauri::command]
async fn update_idea(
    id: String,
    title: String,
    raw_content: String,
    corrected_script: String
) -> Result<IdeaEntry, String> {
    let path = get_ideas_path();
    if !path.exists() {
        return Err("Ideas file not found".to_string());
    }

    let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut entries: Vec<IdeaEntry> = serde_json::from_str(&file_content).unwrap_or_default();

    let entry = entries.iter_mut().find(|e| e.id == id);
    match entry {
        Some(e) => {
            e.title = title;
            e.raw_content = raw_content;
            e.corrected_script = corrected_script;
            let updated = e.clone();

            let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
            std::fs::write(&path, json).map_err(|e| format!("Failed to save idea: {}", e))?;

            Ok(updated)
        }
        None => Err("Idea entry not found".to_string()),
    }
}

#[tauri::command]
async fn delete_idea(id: String) -> Result<(), String> {
    let path = get_ideas_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut entries: Vec<IdeaEntry> = serde_json::from_str(&content).unwrap_or_default();
        entries.retain(|e| e.id != id);
        let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
        std::fs::write(&path, json).map_err(|e| format!("Failed to save ideas: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn update_transcript(state: tauri::State<'_, Arc<AppState>>, lines: Vec<String>) -> Result<(), String> {
    let mut transcript = state.transcript_lines.lock().map_err(|e| e.to_string())?;
    *transcript = lines;
    Ok(())
}

// Chat history CRUD commands
#[tauri::command]
async fn get_chat_history(since: Option<i64>, limit: Option<usize>) -> Result<Vec<ChatHistoryEntry>, String> {
    let path = get_chat_history_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut entries: Vec<ChatHistoryEntry> = serde_json::from_str(&content).unwrap_or_default();

        // Filter by timestamp if since is provided
        if let Some(since_ts) = since {
            entries.retain(|e| e.timestamp >= since_ts);
        }

        // Sort by timestamp (oldest first)
        entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        // Apply limit if provided
        if let Some(max) = limit {
            if entries.len() > max {
                entries = entries.into_iter().rev().take(max).collect::<Vec<_>>();
                entries.reverse();
            }
        }

        Ok(entries)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn add_chat_entry(entry: ChatHistoryEntry) -> Result<ChatHistoryEntry, String> {
    let path = get_chat_history_path();
    let mut entries: Vec<ChatHistoryEntry> = if path.exists() {
        let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        vec![]
    };

    entries.push(entry.clone());

    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save chat history: {}", e))?;

    Ok(entry)
}

#[tauri::command]
async fn clear_chat_history() -> Result<(), String> {
    let path = get_chat_history_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to clear chat history: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn get_chat_history_stats() -> Result<serde_json::Value, String> {
    let path = get_chat_history_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let entries: Vec<ChatHistoryEntry> = serde_json::from_str(&content).unwrap_or_default();

        let total_entries = entries.len();
        let total_chars: usize = entries.iter().map(|e| e.content.len()).sum();
        let estimated_tokens = total_chars / 4; // ~4 chars per token

        // Count by type
        let transcript_count = entries.iter().filter(|e| e.entry_type == "transcript").count();
        let question_count = entries.iter().filter(|e| e.entry_type == "question").count();
        let answer_count = entries.iter().filter(|e| e.entry_type == "answer").count();
        let summary_count = entries.iter().filter(|e| e.entry_type == "summary").count();
        let idea_count = entries.iter().filter(|e| e.entry_type == "idea").count();

        Ok(serde_json::json!({
            "total_entries": total_entries,
            "total_chars": total_chars,
            "estimated_tokens": estimated_tokens,
            "by_type": {
                "transcript": transcript_count,
                "question": question_count,
                "answer": answer_count,
                "summary": summary_count,
                "idea": idea_count
            }
        }))
    } else {
        Ok(serde_json::json!({
            "total_entries": 0,
            "total_chars": 0,
            "estimated_tokens": 0,
            "by_type": {}
        }))
    }
}

// Context snapshot commands
#[tauri::command]
async fn save_context_snapshot(snapshot: ContextSnapshot) -> Result<ContextSnapshot, String> {
    let path = get_context_snapshots_path();
    let mut snapshots: Vec<ContextSnapshot> = if path.exists() {
        let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&file_content).unwrap_or_default()
    } else {
        vec![]
    };

    snapshots.push(snapshot.clone());

    let json = serde_json::to_string_pretty(&snapshots).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Failed to save context snapshot: {}", e))?;

    Ok(snapshot)
}

#[tauri::command]
async fn get_latest_snapshot() -> Result<Option<ContextSnapshot>, String> {
    let path = get_context_snapshots_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut snapshots: Vec<ContextSnapshot> = serde_json::from_str(&content).unwrap_or_default();

        // Sort by created_at descending and return the latest
        snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(snapshots.into_iter().next())
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn get_all_snapshots() -> Result<Vec<ContextSnapshot>, String> {
    let path = get_context_snapshots_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut snapshots: Vec<ContextSnapshot> = serde_json::from_str(&content).unwrap_or_default();
        snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(snapshots)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn clear_context_snapshots() -> Result<(), String> {
    let path = get_context_snapshots_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to clear snapshots: {}", e))?;
    }
    Ok(())
}

// ============================================================================
// NEW: Database and Chat Commands
// ============================================================================

/// Initialize the SQLite database and migrate from JSON if needed
#[tauri::command]
async fn init_database() -> Result<String, String> {
    let mut conn = init_db().map_err(|e| format!("Failed to init database: {}", e))?;

    // Check if we need to migrate (no chat entries yet)
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM chat_entries", [], |r| r.get(0))
        .unwrap_or(0);

    if count == 0 {
        // Migrate from JSON files
        let stats = migrate_from_json(&mut conn)
            .map_err(|e| format!("Migration failed: {}", e))?;

        println!("Migration complete: {} chat entries, {} ideas, {} knowledge, {} snapshots",
            stats.chat_entries_migrated,
            stats.ideas_migrated,
            stats.knowledge_migrated,
            stats.snapshots_migrated);
    }

    Ok("Database initialized".to_string())
}

/// Generate embedding using Gemini API
#[tauri::command]
async fn vector_generate_embedding(
    text: String,
    api_key: String,
) -> Result<Vec<f32>, String> {
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={}", api_key);

    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "content": {
                "parts": [{ "text": text }]
            },
            "model": "models/text-embedding-004"
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, error_text));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let embedding = json["embedding"]["values"]
        .as_array()
        .ok_or_else(|| "Missing embedding values".to_string())?
        .iter()
        .map(|v| v.as_f64().ok_or_else(|| "Invalid float".to_string()).map(|f| f as f32))
        .collect::<Result<Vec<f32>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(embedding)
}

/// Compute cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

/// Search for similar entries using vector similarity (proper implementation)
#[tauri::command]
async fn vector_search(
    query_embedding: Vec<f32>,
    limit: usize,
    entry_types: Option<Vec<String>>,
) -> Result<Vec<ChatHistoryEntry>, String> {
    let conn = init_db().map_err(|e| format!("Failed to open database: {}", e))?;

    let type_filter = entry_types
        .map(|types| format!("'{}'", types.join("','")))
        .unwrap_or_else(|| "'transcript','summary','answer'".to_string());

    // Fetch entries that have embeddings
    let query = format!(r#"
        SELECT id, timestamp, entry_type, content, metadata, embedding
        FROM chat_entries
        WHERE entry_type IN ({}) AND embedding IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 100
    "#, type_filter);

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Query failed: {}", e))?;

    // Collect entries with their embeddings
    let mut entries_with_scores: Vec<(ChatHistoryEntry, f32)> = Vec::new();

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let timestamp: i64 = row.get(1)?;
        let entry_type: String = row.get(2)?;
        let content: String = row.get(3)?;
        let metadata: Option<String> = row.get(4)?;
        let embedding_blob: Option<Vec<u8>> = row.get(5)?;
        Ok((id, timestamp, entry_type, content, metadata, embedding_blob))
    })
    .map_err(|e| format!("Execute failed: {}", e))?;

    for row_result in rows {
        let (id, timestamp, entry_type, content, metadata, embedding_blob) =
            row_result.map_err(|e| format!("Row extraction failed: {}", e))?;

        // Calculate similarity if embedding exists
        let similarity = if let Some(blob) = embedding_blob {
            let entry_embedding = database::blob_to_embedding(&blob);
            cosine_similarity(&query_embedding, &entry_embedding)
        } else {
            0.0
        };

        let entry = ChatHistoryEntry {
            id,
            timestamp,
            entry_type,
            content,
            metadata: metadata.and_then(|s| serde_json::from_str(&s).ok()),
        };

        entries_with_scores.push((entry, similarity));
    }

    // Sort by similarity (highest first)
    entries_with_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Return top N entries
    let entries: Vec<ChatHistoryEntry> = entries_with_scores
        .into_iter()
        .take(limit)
        .map(|(entry, _)| entry)
        .collect();

    Ok(entries)
}

/// Search knowledge entries by semantic similarity
#[tauri::command]
async fn search_knowledge_semantic(
    query_embedding: Vec<f32>,
    limit: usize,
    nominated_only: bool,
) -> Result<Vec<KnowledgeEntry>, String> {
    let conn = init_db().map_err(|e| format!("Failed to open database: {}", e))?;

    let nominated_filter = if nominated_only { "AND nominated = 1" } else { "" };

    let query = format!(r#"
        SELECT id, content, created_at, nominated, embedding
        FROM knowledge_entries
        WHERE embedding IS NOT NULL {}
    "#, nominated_filter);

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut entries_with_scores: Vec<(KnowledgeEntry, f32)> = Vec::new();

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let content: String = row.get(1)?;
        let created_at: i64 = row.get(2)?;
        let nominated: i32 = row.get(3)?;
        let embedding_blob: Option<Vec<u8>> = row.get(4)?;
        Ok((id, content, created_at, nominated, embedding_blob))
    })
    .map_err(|e| format!("Execute failed: {}", e))?;

    for row_result in rows {
        let (id, content, created_at, nominated, embedding_blob) =
            row_result.map_err(|e| format!("Row extraction failed: {}", e))?;

        let similarity = if let Some(blob) = embedding_blob {
            let entry_embedding = database::blob_to_embedding(&blob);
            cosine_similarity(&query_embedding, &entry_embedding)
        } else {
            0.0
        };

        entries_with_scores.push((KnowledgeEntry {
            id,
            content,
            created_at,
            nominated: nominated == 1,
        }, similarity));
    }

    // Sort by similarity
    entries_with_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let entries: Vec<KnowledgeEntry> = entries_with_scores
        .into_iter()
        .take(limit)
        .map(|(entry, _)| entry)
        .collect();

    Ok(entries)
}

/// Send a chat message with streaming response
#[tauri::command]
async fn chat_send_message_stream(
    app_handle: AppHandle,
    session_id: String,
    message: String,
    context: String,
    api_key: String,
    model: String,
) -> Result<String, String> {
    use tokio::spawn;

    let message_id = uuid::Uuid::new_v4().to_string();
    let message_id_clone = message_id.clone();
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();
    let message_clone = message.clone();

    spawn(async move {
        // Use alt=sse for proper Server-Sent Events streaming
        let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
            model, api_key);

        let client = reqwest::Client::new();

        // Build prompt with context
        let user_message = if context.is_empty() {
            message.clone()
        } else {
            format!("{}\n\nUser question: {}", context, message)
        };

        println!("Chat request: model={}, message={}", model, message_clone);

        // System instruction for meeting/interview assistant
        let system_instruction = "You are a personal meeting/interview assistant. Your job is to help the user speak confidently. \
            IMPORTANT: Generate responses in FIRST PERSON that the user can READ ALOUD or say directly. \
            Example: If asked 'introduce yourself', respond with 'I'm a fullstack developer at...' NOT 'You are a developer...'. \
            Use the knowledge base context to personalize responses with the user's actual background, skills, and experience. \
            Keep responses concise and natural-sounding (2-4 sentences). \
            Write as if you ARE the user speaking to others in a meeting or interview.";

        let response = match client
            .post(&url)
            .json(&serde_json::json!({
                "system_instruction": {
                    "parts": [{"text": system_instruction}]
                },
                "contents": [{
                    "parts": [{"text": user_message}]
                }],
                "generationConfig": {
                    "maxOutputTokens": 500,
                    "temperature": 0.7
                }
            }))
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                eprintln!("Request error: {}", e);
                let _ = app_handle_clone.emit("chat-error", serde_json::json!({
                    "sessionId": session_id_clone,
                    "messageId": message_id_clone,
                    "error": e.to_string()
                }));
                return;
            }
        };

        // Check response status
        let status = response.status();
        println!("Response status: {}", status);

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            eprintln!("API error response: {}", error_text);
            let _ = app_handle_clone.emit("chat-error", serde_json::json!({
                "sessionId": session_id_clone,
                "messageId": message_id_clone,
                "error": format!("API error {}: {}", status, error_text)
            }));
            return;
        }

        // Read the full response and process SSE events
        // Note: bytes_stream() may not work well with all server configurations
        println!("Starting to read response body...");

        let response_bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(e) => {
                eprintln!("Failed to read response bytes: {}", e);
                let _ = app_handle_clone.emit("chat-error", serde_json::json!({
                    "sessionId": session_id_clone,
                    "messageId": message_id_clone,
                    "error": format!("Failed to read response: {}", e)
                }));
                return;
            }
        };

        let response_text = match String::from_utf8(response_bytes.to_vec()) {
            Ok(text) => text,
            Err(e) => {
                eprintln!("Failed to decode response as UTF-8: {}", e);
                return;
            }
        };

        println!("Response body length: {}", response_text.len());
        println!("Response preview: {}", &response_text[..response_text.len().min(500)]);

        // Normalize line endings
        let normalized = response_text.replace("\r\n", "\n").replace("\r", "\n");

        // Process SSE events
        // Format: "data: {...}\n\n" or "data: {...}\ndata: {...}\n"
        for line in normalized.lines() {
            let line = line.trim();
            if line.starts_with("data: ") {
                let json_str = &line[6..];
                println!("Processing SSE line: {}", &json_str[..json_str.len().min(100)]);

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(json_str) {
                    // Extract text from Gemini response format
                    if let Some(candidates) = json.get("candidates").and_then(|v| v.as_array()) {
                        for candidate in candidates {
                            if let Some(content) = candidate.get("content") {
                                if let Some(parts) = content.get("parts").and_then(|v| v.as_array()) {
                                    for part in parts {
                                        if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                            println!("Emitting text chunk: {}", text);
                                            let _ = app_handle_clone.emit("chat-chunk", serde_json::json!({
                                                "sessionId": session_id_clone,
                                                "messageId": message_id_clone,
                                                "text": text
                                            }));
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    println!("Failed to parse JSON from line: {}", json_str);
                }
            }
        }

        // If no SSE format detected, try parsing as JSON array (non-streaming format)
        if !normalized.contains("data: ") {
            println!("No SSE format detected, trying JSON array format...");
            if let Ok(json_array) = serde_json::from_str::<serde_json::Value>(&normalized) {
                if let Some(array) = json_array.as_array() {
                    for chunk in array {
                        if let Some(candidates) = chunk.get("candidates").and_then(|v| v.as_array()) {
                            for candidate in candidates {
                                if let Some(content) = candidate.get("content") {
                                    if let Some(parts) = content.get("parts").and_then(|v| v.as_array()) {
                                        for part in parts {
                                            if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                                                println!("Emitting text (array): {}", text);
                                                let _ = app_handle_clone.emit("chat-chunk", serde_json::json!({
                                                    "sessionId": session_id_clone,
                                                    "messageId": message_id_clone,
                                                    "text": text
                                                }));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Emit completion event
        println!("Emitting complete event");
        let _ = app_handle_clone.emit("chat-complete", serde_json::json!({
            "sessionId": session_id_clone,
            "messageId": message_id_clone
        }));
    });

    Ok(message_id)
}

/// Get chat history from SQLite
#[tauri::command]
async fn chat_get_history(
    session_id: Option<String>,
    _since: Option<i64>,
    _limit: Option<usize>,
) -> Result<Vec<ChatHistoryEntry>, String> {
    let conn = init_db().map_err(|e| format!("Failed to open database: {}", e))?;

    let entries = if let Some(ref sid) = session_id {
        let mut stmt = conn.prepare("SELECT id, timestamp, entry_type, content, metadata FROM chat_entries WHERE session_id = ? ORDER BY timestamp DESC")
            .map_err(|e| format!("Prepare failed: {}", e))?;

        let result = stmt.query_map(params![sid], |row| {
            Ok(ChatHistoryEntry {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                entry_type: row.get(2)?,
                content: row.get(3)?,
                metadata: row.get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        result
    } else {
        let mut stmt = conn.prepare("SELECT id, timestamp, entry_type, content, metadata FROM chat_entries ORDER BY timestamp DESC")
            .map_err(|e| format!("Prepare failed: {}", e))?;

        let result = stmt.query_map(params![], |row| {
            Ok(ChatHistoryEntry {
                id: row.get(0)?,
                timestamp: row.get(1)?,
                entry_type: row.get(2)?,
                content: row.get(3)?,
                metadata: row.get::<_, Option<String>>(4)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
        result
    };

    Ok(entries)
}

/// Create a new chat session
#[tauri::command]
async fn create_session() -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    Ok(session_id)
}

/// Get relevant context for AI chat (knowledge + transcript + recent history)
/// Now with optional semantic search for smarter context retrieval
#[tauri::command]
async fn get_chat_context(
    state: tauri::State<'_, Arc<AppState>>,
    limit: Option<usize>,
    query: Option<String>,
    api_key: Option<String>,
) -> Result<serde_json::Value, String> {
    // 1. Get nominated knowledge entries
    let knowledge_path = get_knowledge_path();
    let knowledge_context = if knowledge_path.exists() {
        let content = std::fs::read_to_string(&knowledge_path).map_err(|e| e.to_string())?;
        let entries: Vec<KnowledgeEntry> = serde_json::from_str(&content).unwrap_or_default();
        let nominated: Vec<&KnowledgeEntry> = entries.iter().filter(|e| e.nominated).collect();
        if nominated.is_empty() {
            String::new()
        } else {
            format!("=== User's Knowledge Base ===\n{}\n",
                nominated.iter().map(|e| format!("- {}", e.content)).collect::<Vec<_>>().join("\n"))
        }
    } else {
        String::new()
    };

    // 2. Get current transcript lines (drop lock before await)
    let transcript_context = {
        let transcript_lines = state.transcript_lines.lock().map_err(|e| e.to_string())?;
        if transcript_lines.is_empty() {
            String::new()
        } else {
            let recent_lines: Vec<String> = transcript_lines.iter().rev().take(20).cloned().collect::<Vec<_>>().into_iter().rev().collect();
            format!("=== Current Conversation Transcript (Recent Lines) ===\n{}\n",
                recent_lines.join("\n"))
        }
    };

    // 4. Get meeting context if set (do this before await too)
    let meeting_context = {
        let settings = state.settings.lock().map_err(|e| e.to_string())?;
        settings.ai.as_ref()
            .and_then(|ai| ai.meeting_context.as_ref())
            .map(|ctx| format!("=== Meeting Context ===\n{}\n", ctx))
            .unwrap_or_default()
    };

    // 3. Get relevant history - use semantic search if query and api_key provided
    let history_limit = limit.unwrap_or(10);
    let history_context = if let (Some(q), Some(key)) = (&query, &api_key) {
        // Try semantic search
        match get_semantic_history_context(q, &key, history_limit).await {
            Ok(ctx) => ctx,
            Err(e) => {
                println!("Semantic search failed, falling back to recent: {}", e);
                get_recent_history_context(history_limit)?
            }
        }
    } else {
        get_recent_history_context(history_limit)?
    };

    // Combine all context
    let full_context = format!("{}{}{}{}",
        meeting_context,
        knowledge_context,
        transcript_context,
        history_context
    );

    Ok(serde_json::json!({
        "context": full_context,
        "has_knowledge": !knowledge_context.is_empty(),
        "has_transcript": !transcript_context.is_empty(),
        "has_history": !history_context.is_empty(),
        "has_meeting_context": !meeting_context.is_empty()
    }))
}

/// Get recent history context (fallback when no semantic search)
fn get_recent_history_context(limit: usize) -> Result<String, String> {
    let conn = init_db().map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT content, entry_type FROM chat_entries
         WHERE entry_type IN ('answer', 'summary')
         ORDER BY timestamp DESC
         LIMIT ?"
    ).map_err(|e| format!("Prepare failed: {}", e))?;

    let history_entries: Vec<(String, String)> = stmt.query_map(params![limit], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })
    .map_err(|e| format!("Query failed: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    if history_entries.is_empty() {
        Ok(String::new())
    } else {
        Ok(format!("=== Recent AI Responses ===\n{}\n",
            history_entries.iter()
                .map(|(content, entry_type)| format!("[{}]: {}", entry_type, content))
                .collect::<Vec<_>>()
                .join("\n\n")))
    }
}

/// Get semantically relevant history context using embeddings
async fn get_semantic_history_context(query: &str, api_key: &str, limit: usize) -> Result<String, String> {
    // Generate embedding for query
    let embedding = generate_embedding(query, api_key).await?;

    // Search for similar entries
    let conn = init_db().map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare(r#"
        SELECT id, content, entry_type, embedding
        FROM chat_entries
        WHERE entry_type IN ('answer', 'summary', 'transcript') AND embedding IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 50
    "#).map_err(|e| format!("Query failed: {}", e))?;

    let mut entries_with_scores: Vec<(String, String, f32)> = Vec::new();

    let rows = stmt.query_map([], |row| {
        let content: String = row.get(1)?;
        let entry_type: String = row.get(2)?;
        let embedding_blob: Option<Vec<u8>> = row.get(3)?;
        Ok((content, entry_type, embedding_blob))
    }).map_err(|e| format!("Execute failed: {}", e))?;

    for row_result in rows {
        let (content, entry_type, embedding_blob) = row_result.map_err(|e| e.to_string())?;

        let similarity = if let Some(blob) = embedding_blob {
            let entry_embedding = database::blob_to_embedding(&blob);
            cosine_similarity(&embedding, &entry_embedding)
        } else {
            0.0
        };

        if similarity > 0.3 { // Only include entries with decent similarity
            entries_with_scores.push((content, entry_type, similarity));
        }
    }

    // Sort by similarity
    entries_with_scores.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let top_entries: Vec<_> = entries_with_scores.into_iter().take(limit).collect();

    if top_entries.is_empty() {
        Ok(String::new())
    } else {
        Ok(format!("=== Relevant Context (Semantic) ===\n{}\n",
            top_entries.iter()
                .map(|(content, entry_type, score)| format!("[{} ({:.0}%)]: {}", entry_type, score * 100.0, content))
                .collect::<Vec<_>>()
                .join("\n\n")))
    }
}

/// Helper to generate embedding
async fn generate_embedding(text: &str, api_key: &str) -> Result<Vec<f32>, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={}",
        api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&serde_json::json!({
            "content": {
                "parts": [{"text": text}]
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    let data: serde_json::Value = response.json().await.map_err(|e| format!("Parse failed: {}", e))?;

    let embedding = data["embedding"]["values"]
        .as_array()
        .ok_or("Invalid embedding response")?
        .iter()
        .map(|v| v.as_f64().unwrap_or(0.0) as f32)
        .collect();

    Ok(embedding)
}

fn load_settings() -> Settings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }
    Settings::default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let settings = load_settings();

    let state = Arc::new(AppState {
        process: Mutex::new(None),
        settings: Mutex::new(settings),
        transcript_lines: Mutex::new(Vec::new()),
    });

    let state_clone = state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            start_captions,
            stop_captions,
            is_running,
            get_settings,
            save_settings,
            export_captions,
            select_model_file,
            check_binary_exists,
            check_microphone_permission,
            get_binary_path,
            get_bundled_model_path,
            get_binary_debug_info,
            get_transcript,
            add_transcript_line,
            clear_transcript,
            update_transcript,
            get_knowledge,
            save_knowledge,
            add_knowledge_entry,
            update_knowledge_entry,
            toggle_knowledge_nomination,
            delete_knowledge_entry,
            get_ideas,
            add_idea,
            update_idea,
            delete_idea,
            // Chat history commands
            get_chat_history,
            add_chat_entry,
            clear_chat_history,
            get_chat_history_stats,
            // Context snapshot commands
            save_context_snapshot,
            get_latest_snapshot,
            get_all_snapshots,
            clear_context_snapshots,
            // NEW: Database and chat commands
            init_database,
            vector_generate_embedding,
            vector_search,
            search_knowledge_semantic,
            chat_send_message_stream,
            chat_get_history,
            create_session,
            get_chat_context,
        ])
        .on_window_event(move |_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the zig process when the window is closed
                if let Ok(mut process_guard) = state_clone.process.lock() {
                    if let Some(mut child) = process_guard.take() {
                        println!("Cleaning up zig-april-captions process on exit...");
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
