use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

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
    #[serde(default)]
    pub ai: Option<AISettings>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            audio_source: "mic".to_string(),
            font_size: 24,
            theme: "dark".to_string(),
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

fn get_zig_binary_path() -> String {
    // Try to find the zig-april-captions binary
    // First check if it's in PATH or relative to the app
    let candidates = vec![
        // In the same parent directory (dev mode)
        "../zig-april-captions/zig-out/bin/zig-april-captions".to_string(),
        // Absolute path to user's build
        format!(
            "{}/workspace/local/zig/zig-april-captions/zig-out/bin/zig-april-captions",
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        ),
        // In PATH
        "zig-april-captions".to_string(),
    ];

    for candidate in candidates {
        if std::path::Path::new(&candidate).exists() || candidate == "zig-april-captions" {
            return candidate;
        }
    }

    // Default to relative path
    "../zig-april-captions/zig-out/bin/zig-april-captions".to_string()
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

    let binary_path = get_zig_binary_path();

    // Build command arguments
    let mut args = vec!["--json".to_string()];
    if audio_source == "monitor" {
        args.push("--monitor".to_string());
    }
    args.push(model_path.clone());

    println!("Starting: {} {:?}", binary_path, args);

    // Spawn the process
    let mut child = Command::new(&binary_path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start zig-april-captions: {}", e))?;

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
async fn check_binary_exists() -> Result<bool, String> {
    let path = get_zig_binary_path();
    Ok(std::path::Path::new(&path).exists() || path == "zig-april-captions")
}

#[tauri::command]
async fn get_binary_path() -> Result<String, String> {
    Ok(get_zig_binary_path())
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
