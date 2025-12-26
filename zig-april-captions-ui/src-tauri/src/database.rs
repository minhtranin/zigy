// Database module for SQLite with vector support
use rusqlite::{Connection, Result as SqliteResult, params};
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

/// Get the database path
pub fn get_db_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zigy");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("zigy.db")
}

/// Initialize the database with all required tables
pub fn init_db() -> SqliteResult<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Create chat_entries table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_entries (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            entry_type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            embedding BLOB,
            session_id TEXT,
            parent_id TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        )",
        [],
    )?;

    // Create indexes for common queries
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_entries_timestamp ON chat_entries(timestamp DESC)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_entries_type ON chat_entries(entry_type)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_entries_session ON chat_entries(session_id)",
        [],
    )?;

    // Create knowledge_entries table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS knowledge_entries (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            nominated INTEGER NOT NULL DEFAULT 1,
            embedding BLOB
        )",
        [],
    )?;

    // Create context_snapshots table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS context_snapshots (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL,
            summary TEXT NOT NULL,
            covered_until INTEGER NOT NULL,
            original_token_count INTEGER NOT NULL,
            compressed_token_count INTEGER NOT NULL
        )",
        [],
    )?;

    // Create ideas table (for backward compatibility)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ideas (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            raw_content TEXT NOT NULL,
            corrected_script TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}

/// Chat history entry (matches JSON structure for migration)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatHistoryEntry {
    pub id: String,
    pub timestamp: i64,
    pub entry_type: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

/// Migration statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStats {
    pub chat_entries_migrated: usize,
    pub ideas_migrated: usize,
    pub knowledge_migrated: usize,
    pub snapshots_migrated: usize,
}

/// Migrate data from JSON files to SQLite
pub fn migrate_from_json(conn: &mut Connection) -> Result<MigrationStats, String> {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("zigy");

    let mut stats = MigrationStats {
        chat_entries_migrated: 0,
        ideas_migrated: 0,
        knowledge_migrated: 0,
        snapshots_migrated: 0,
    };

    // Migrate chat_history.json
    let chat_history_path = config_dir.join("chat_history.json");
    if chat_history_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&chat_history_path) {
            if let Ok(entries) = serde_json::from_str::<Vec<ChatHistoryEntry>>(&content) {
                for entry in entries {
                    if migrate_chat_entry(conn, &entry).is_ok() {
                        stats.chat_entries_migrated += 1;
                    }
                }
            }
        }
    }

    // Migrate ideas.json
    let ideas_path = config_dir.join("ideas.json");
    if ideas_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&ideas_path) {
            if let Ok(ideas) = serde_json::from_str::<Vec<IdeaEntry>>(&content) {
                for idea in ideas {
                    if migrate_idea(conn, &idea).is_ok() {
                        stats.ideas_migrated += 1;
                    }
                }
            }
        }
    }

    // Migrate knowledge.json
    let knowledge_path = config_dir.join("knowledge.json");
    if knowledge_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&knowledge_path) {
            if let Ok(knowledge) = serde_json::from_str::<Vec<KnowledgeEntry>>(&content) {
                for entry in knowledge {
                    if migrate_knowledge_entry(conn, &entry).is_ok() {
                        stats.knowledge_migrated += 1;
                    }
                }
            }
        }
    }

    // Migrate context_snapshots.json
    let snapshots_path = config_dir.join("context_snapshots.json");
    if snapshots_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&snapshots_path) {
            if let Ok(snapshots) = serde_json::from_str::<Vec<ContextSnapshot>>(&content) {
                for snapshot in snapshots {
                    if migrate_context_snapshot(conn, &snapshot).is_ok() {
                        stats.snapshots_migrated += 1;
                    }
                }
            }
        }
    }

    Ok(stats)
}

/// Migrate a single chat entry
fn migrate_chat_entry(conn: &mut Connection, entry: &ChatHistoryEntry) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO chat_entries (id, timestamp, entry_type, content, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            &entry.id,
            &entry.timestamp,
            &entry.entry_type,
            &entry.content,
            &entry.metadata.as_ref().map(|m| serde_json::to_string(m).ok()).flatten(),
        ],
    )?;
    Ok(())
}

/// Idea entry (matches JSON structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeaEntry {
    pub id: String,
    pub title: String,
    pub raw_content: String,
    pub corrected_script: String,
    pub created_at: i64,
}

/// Migrate a single idea
fn migrate_idea(conn: &mut Connection, idea: &IdeaEntry) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO ideas (id, title, raw_content, corrected_script, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            &idea.id,
            &idea.title,
            &idea.raw_content,
            &idea.corrected_script,
            &idea.created_at,
        ],
    )?;
    Ok(())
}

/// Knowledge entry (matches JSON structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub content: String,
    pub created_at: i64,
    pub nominated: bool,
}

/// Migrate a single knowledge entry
fn migrate_knowledge_entry(conn: &mut Connection, entry: &KnowledgeEntry) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO knowledge_entries (id, content, created_at, nominated)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            &entry.id,
            &entry.content,
            &entry.created_at,
            &(entry.nominated as i32),
        ],
    )?;
    Ok(())
}

/// Context snapshot (matches JSON structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub id: String,
    pub created_at: i64,
    pub summary: String,
    pub covered_until: i64,
    pub original_token_count: i64,
    pub compressed_token_count: i64,
}

/// Migrate a single context snapshot
fn migrate_context_snapshot(conn: &mut Connection, snapshot: &ContextSnapshot) -> SqliteResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO context_snapshots (id, created_at, summary, covered_until, original_token_count, compressed_token_count)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            &snapshot.id,
            &snapshot.created_at,
            &snapshot.summary,
            &snapshot.covered_until,
            &snapshot.original_token_count,
            &snapshot.compressed_token_count,
        ],
    )?;
    Ok(())
}

/// Convert embedding Vec<f32> to BLOB for SQLite storage
#[allow(dead_code)]
pub fn embedding_to_blob(embedding: &[f32]) -> Option<Vec<u8>> {
    // Convert f32 array to bytes
    let mut bytes = Vec::with_capacity(embedding.len() * 4);
    for &val in embedding {
        // Use little-endian byte order
        bytes.extend_from_slice(&val.to_le_bytes());
    }
    Some(bytes)
}

/// Convert BLOB from SQLite back to Vec<f32>
pub fn blob_to_embedding(blob: &[u8]) -> Vec<f32> {
    let mut embedding = Vec::new();
    for chunk in blob.chunks_exact(4) {
        let bytes: [u8; 4] = [chunk[0], chunk[1], chunk[2], chunk[3]];
        embedding.push(f32::from_le_bytes(bytes));
    }
    embedding
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_conversion() {
        let original = vec![1.0, -0.5, 0.25, -0.125];
        let blob = embedding_to_blob(&original).unwrap();
        let restored = blob_to_embedding(&blob);
        assert_eq!(original, restored);
    }
}
