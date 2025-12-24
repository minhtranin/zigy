use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

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
        .join("zipy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

fn get_knowledge_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zipy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("knowledge.json")
}

fn get_ideas_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zipy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("ideas.json")
}

fn get_chat_history_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zipy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("chat_history.json")
}

fn get_context_snapshots_path() -> std::path::PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zipy");
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

// Chat history entry - unified record of all interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryEntry {
    pub id: String,
    pub timestamp: i64,
    pub entry_type: String, // "transcript" | "question" | "answer" | "summary" | "idea" | "translation"
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>, // For type-specific data
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

    // For Linux .deb packages: check /usr/lib/zipy/
    // This is where deb.files installs the binary
    #[cfg(target_os = "linux")]
    {
        let deb_path = Path::new("/usr/lib/zipy").join(&binary_name);
        println!("Checking .deb installation path: {}", deb_path.display());
        if deb_path.exists() {
            println!("Found zig-april-captions at: {}", deb_path.display());
            return Ok(deb_path.to_string_lossy().to_string());
        }
    }

    // Try Tauri's resource resolver (for some bundle formats)
    if let Ok(resource_path) = app_handle
        .path()
        .resolve(&binary_name, tauri::path::BaseDirectory::Resource)
    {
        println!("Checking Tauri resource path: {}", resource_path.display());
        if resource_path.exists() {
            println!("Found zig-april-captions in Tauri resources at: {}", resource_path.display());
            return Ok(resource_path.to_string_lossy().to_string());
        }
    }

    // Dev mode fallbacks
    let dev_candidates = vec![
        // In the same parent directory (dev mode)
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
    let mut child = Command::new(&binary_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start zig-april-captions at {}: {}", binary_path, e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;

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
    content.push_str("# Zipy Export\n\n");

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

#[tauri::command]
async fn check_binary_exists(app_handle: AppHandle) -> Result<bool, String> {
    let path = get_zig_binary_path(&app_handle)?;
    Ok(std::path::Path::new(&path).exists() || path == "zig-april-captions" || path == "zig-april-captions.exe")
}

#[tauri::command]
async fn get_binary_path(app_handle: AppHandle) -> Result<String, String> {
    get_zig_binary_path(&app_handle)
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
            get_binary_path,
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
