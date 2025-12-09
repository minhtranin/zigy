import { useEffect, useRef, useState } from 'react';
import './HistoryDisplay.css';

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

  const lines = text ? text.toLowerCase().split('\n') : [];

  // Auto-scroll to bottom when new text is added (only when not editing)
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
    <div className="history-display" ref={containerRef}>
      <div className="history-header">
        <span>history {wordCount > 0 && `(${wordCount} words)`}</span>
      </div>
      {lines.length > 0 ? (
        <div className="history-text" style={{ fontSize: `${fontSize}px` }}>
          {lines.map((line, i) => (
            <div key={i} className="history-line">
              {editingIndex === i ? (
                <div className="history-line-edit">
                  <input
                    type="text"
                    className="history-line-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ fontSize: `${fontSize}px` }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <div className="history-line-actions">
                    <button className="btn-line-action btn-save" onClick={handleSaveEdit}>✓</button>
                    <button className="btn-line-action btn-cancel" onClick={handleCancelEdit}>✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="history-line-text">{line}</span>
                  {onUpdateHistory && (
                    <div className="history-line-actions">
                      <button
                        className="btn-line-action btn-edit"
                        onClick={() => handleStartEdit(i)}
                        title="Edit"
                      >
                        ✎ edit
                      </button>
                      <button
                        className="btn-line-action btn-delete"
                        onClick={() => handleDeleteLine(i)}
                        title="Delete"
                      >
                        ✕ delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="history-placeholder" style={{ fontSize: `${fontSize}px` }}>
          history will appear here...
        </div>
      )}
    </div>
  );
}
