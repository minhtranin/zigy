import { useEffect, useRef, useState } from 'react';
import {
  Pencil,
  Trash2,
  HelpCircle,
  MessageSquare,
  Mic,
  Check,
  X,
} from 'lucide-react';

interface Props {
  text: string;
  wordCount: number;
  fontSize: number;
  onUpdateHistory?: (newText: string) => void;
}

export function HistoryDisplay({ text, wordCount, fontSize, onUpdateHistory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const lines = text ? text.toLowerCase().split('\n').filter(line => line.trim() !== '') : [];

  useEffect(() => {
    if (containerRef.current && editingIndex === null) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, editingIndex]);

  const handleStartEdit = (index: number) => {
    setEditText(lines[index]);
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleSaveEdit = () => {
    if (onUpdateHistory && editingIndex !== null) {
      const newLines = [...lines];
      newLines[editingIndex] = editText.trim();
      onUpdateHistory(newLines.join('\n'));
    }
    setEditingIndex(null);
    setEditText('');
  };

  const handleDeleteLine = (index: number) => {
    if (onUpdateHistory) {
      const newLines = lines.filter((_, i) => i !== index);
      onUpdateHistory(newLines.join('\n'));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          History {wordCount > 0 && `(${wordCount} words)`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" ref={containerRef}>
        {lines.length > 0 ? (
          <div className="text-gray-800 dark:text-gray-200" style={{ fontSize: `${fontSize}px` }}>
            {lines.map((line, i) => {
              const alwaysShowActions = i >= lines.length - 3;
              return (
                <div key={i} className="group flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                  {editingIndex === i ? (
                    <div className="flex w-full items-center gap-2">
                      <input
                        type="text"
                        className="flex-grow bg-transparent border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{ fontSize: `${fontSize}px` }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button className="text-green-500 hover:text-green-400 p-1" onClick={handleSaveEdit}><Check size={18} /></button>
                        <button className="text-red-500 hover:text-red-400 p-1" onClick={handleCancelEdit}><X size={18} /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="flex-1 min-w-0 truncate">{line}</span>
                      {onUpdateHistory && (
                        <div className={`flex items-center gap-3 transition-opacity duration-200 flex-shrink-0 ${alwaysShowActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button className="flex items-center gap-1 text-gray-600 hover:text-blue-500" title="Edit" onClick={() => handleStartEdit(i)}>
                            <Pencil size={18} />
                            <span className="text-sm">Edit</span>
                          </button>
                          <button className="flex items-center gap-1 text-gray-600 hover:text-red-500" onClick={() => handleDeleteLine(i)} title="Delete">
                            <Trash2 size={18} />
                             <span className="text-sm">Delete</span>
                          </button>
                          <button className="flex items-center gap-1 text-gray-600 hover:text-purple-500" title="Ask">
                            <HelpCircle size={18} />
                             <span className="text-sm">Ask</span>
                          </button>
                          <button className="flex items-center gap-1 text-gray-600 hover:text-green-500" title="Answer">
                            <MessageSquare size={18} />
                             <span className="text-sm">Answer</span>
                          </button>
                          <button className="flex items-center gap-1 text-gray-600 hover:text-teal-500" title="Talk">
                            <Mic size={18} />
                             <span className="text-sm">Talk</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 italic text-center py-4" style={{ fontSize: `${fontSize}px` }}>
            History will appear here...
          </div>
        )}
      </div>
    </div>
  );
}
