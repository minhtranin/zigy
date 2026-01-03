import { useState } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { NoteView } from '../types';
import { Translations } from '../translations';
import { NoteItem } from './NoteItem';

interface Props {
  notes: NoteView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewNote: () => void;
  onToggleNominate: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  t: Translations;
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onNewNote,
  onToggleNominate,
  searchQuery,
  onSearchChange,
  t,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'nominated'>('all');

  // Filter notes based on search and nomination filter
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filter === 'all' || note.nominated;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#010409] border-r border-gray-200 dark:border-[#30363D]">
      {/* Header with New button */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#30363D]">
        <button
          onClick={onNewNote}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
        >
          <Plus size={16} />
          {t.newNote}
        </button>
      </div>

      {/* Search input */}
      <div className="p-3 border-b border-gray-200 dark:border-[#30363D]">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchNotesPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-[#30363D] rounded-md bg-white dark:bg-[#0D1117] text-gray-900 dark:text-[#E6EDF3] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-[#30363D]">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-slate-200 dark:bg-[#21262D] text-slate-900 dark:text-[#E6EDF3]'
              : 'text-slate-600 dark:text-[#7D8590] hover:bg-slate-100 dark:hover:bg-[#21262D]'
          }`}
        >
          {t.allNotes}
        </button>
        <button
          onClick={() => setFilter('nominated')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            filter === 'nominated'
              ? 'bg-slate-200 dark:bg-[#21262D] text-slate-900 dark:text-[#E6EDF3]'
              : 'text-slate-600 dark:text-[#7D8590] hover:bg-slate-100 dark:hover:bg-[#21262D]'
          }`}
        >
          {t.nominatedNotes}
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <FileText size={40} className="text-gray-300 dark:text-[#7D8590] mb-3" />
            <p className="text-sm text-gray-500 dark:text-[#7D8590]">
              {searchQuery ? t.noNotesFound : t.noNotesYet}
            </p>
            {!searchQuery && (
              <p className="text-xs text-gray-400 dark:text-[#7D8590] mt-1">
                {t.addFirstNote}
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#21262D]">
            {filteredNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isSelected={selectedId === note.id}
                onSelect={onSelect}
                onToggleNominate={onToggleNominate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
