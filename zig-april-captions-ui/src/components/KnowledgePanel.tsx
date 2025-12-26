import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KnowledgeEntry, NoteView } from '../types';
import { Translations } from '../translations';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';

interface Props {
  t: Translations;
}

// Convert KnowledgeEntry to NoteView
function toNoteView(entry: KnowledgeEntry): NoteView {
  const lines = entry.content.split('\n').filter((l) => l.trim());
  const firstLine = lines[0] || '';
  const title = firstLine.slice(0, 50) || 'Untitled Note';
  const preview = entry.content.slice(0, 100);

  return {
    id: entry.id,
    title,
    preview,
    content: entry.content,
    nominated: entry.nominated,
    created_at: entry.created_at,
  };
}

export function KnowledgePanel({ t }: Props) {
  const [notes, setNotes] = useState<NoteView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load notes from backend
  const loadNotes = useCallback(async () => {
    try {
      const entries = await invoke<KnowledgeEntry[]>('get_knowledge');
      // Sort by created_at descending (newest first)
      const sorted = entries.sort((a, b) => b.created_at - a.created_at);
      setNotes(sorted.map(toNoteView));
    } catch (e) {
      console.error('Failed to load notes:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Get selected note
  const selectedNote = notes.find((n) => n.id === selectedId) || null;

  // Create new note
  const handleNewNote = async () => {
    try {
      await invoke('add_knowledge_entry', { content: '' });
      await loadNotes();
      // Select the newest note (first in the list after reload)
      const entries = await invoke<KnowledgeEntry[]>('get_knowledge');
      const sorted = entries.sort((a, b) => b.created_at - a.created_at);
      if (sorted.length > 0) {
        setSelectedId(sorted[0].id);
      }
    } catch (e) {
      console.error('Failed to create note:', e);
    }
  };

  // Save note content
  const handleSave = async (id: string, content: string) => {
    try {
      await invoke('update_knowledge_entry', { id, content });
      // Update local state
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? toNoteView({ ...n, content } as KnowledgeEntry) : n
        )
      );
    } catch (e) {
      console.error('Failed to save note:', e);
      throw e;
    }
  };

  // Delete note
  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_knowledge_entry', { id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (e) {
      console.error('Failed to delete note:', e);
    }
  };

  // Toggle nomination
  const handleToggleNominate = async (id: string) => {
    try {
      await invoke('toggle_knowledge_nomination', { id });
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, nominated: !n.nominated } : n
        )
      );
    } catch (e) {
      console.error('Failed to toggle nomination:', e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left: Notes list */}
      <div className="w-72 flex-shrink-0">
        <NotesList
          notes={notes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewNote={handleNewNote}
          onToggleNominate={handleToggleNominate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          t={t}
        />
      </div>

      {/* Right: Note editor */}
      <NoteEditor
        note={selectedNote}
        onSave={handleSave}
        onDelete={handleDelete}
        onToggleNominate={handleToggleNominate}
        t={t}
      />
    </div>
  );
}
