import { Star } from 'lucide-react';
import { NoteView } from '../types';

interface Props {
  note: NoteView;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleNominate: (id: string) => void;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${weeks}w ago`;
}

export function NoteItem({ note, isSelected, onSelect, onToggleNominate }: Props) {
  return (
    <div
      className={`group px-3 py-2 cursor-pointer border-l-2 transition-colors ${
        isSelected
          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500'
          : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#21262D]'
      }`}
      onClick={() => onSelect(note.id)}
    >
      <div className="flex items-start gap-2">
        {/* Nomination star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleNominate(note.id);
          }}
          className={`mt-0.5 flex-shrink-0 transition-colors ${
            note.nominated
              ? 'text-yellow-500 hover:text-yellow-600'
              : 'text-gray-300 dark:text-[#7D8590] hover:text-yellow-400'
          }`}
          title={note.nominated ? 'Remove from AI context' : 'Add to AI context'}
        >
          <Star size={14} fill={note.nominated ? 'currentColor' : 'none'} />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-[#E6EDF3] truncate">
            {note.title}
          </div>
          <div className="text-xs text-gray-500 dark:text-[#7D8590] mt-0.5">
            {formatRelativeTime(note.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
