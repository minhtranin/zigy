import { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, Loader2, Check } from 'lucide-react';
import { NoteView } from '../types';
import { Translations } from '../translations';

interface Props {
  note: NoteView | null;
  onSave: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => void;
  onToggleNominate: (id: string) => void;
  t: Translations;
}

export function NoteEditor({ note, onSave, onDelete, onToggleNominate, t }: Props) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  // Load note content when note changes
  useEffect(() => {
    if (note) {
      setContent(note.content);
      setIsDirty(false);
    } else {
      setContent('');
      setIsDirty(false);
    }
  }, [note?.id]);

  // Auto-save with debounce
  const saveNote = useCallback(async () => {
    if (!note || !isDirty || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(note.id, content);
      setIsDirty(false);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save note:', e);
    } finally {
      setIsSaving(false);
    }
  }, [note, content, isDirty, isSaving, onSave]);

  // Debounced auto-save
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      saveNote();
    }, 1000);

    return () => clearTimeout(timer);
  }, [content, isDirty, saveNote]);

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };

  // Handle delete with confirmation
  const handleDelete = () => {
    if (!note) return;
    if (window.confirm(t.confirmDeleteNote)) {
      onDelete(note.id);
    }
  };

  // Empty state
  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t.noNotesYet}</p>
          <p className="text-xs mt-1">{t.addFirstNote}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        {/* Save status */}
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              {t.noteSaving}
            </span>
          )}
          {showSaved && !isSaving && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Check size={12} />
              {t.noteAutoSaved}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Nominate button */}
          <button
            onClick={() => onToggleNominate(note.id)}
            className={`p-1.5 rounded-md transition-colors ${
              note.nominated
                ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={note.nominated ? t.unnominateNote : t.nominateNote}
          >
            <Star size={18} fill={note.nominated ? 'currentColor' : 'none'} />
          </button>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title={t.deleteNote}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Content area - simple textarea */}
      <div className="flex-1 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={t.knowledgePlaceholder}
          className="w-full h-full p-4 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
