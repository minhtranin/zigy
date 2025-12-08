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
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Auto-scroll to bottom when new text is added (only when not editing)
  useEffect(() => {
    if (containerRef.current && !isEditing) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text, isEditing]);

  const handleStartEdit = () => {
    setEditText(text.toLowerCase());
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleSaveEdit = () => {
    if (onUpdateHistory) {
      onUpdateHistory(editText);
    }
    setIsEditing(false);
    setEditText('');
  };

  return (
    <div className="history-display" ref={containerRef}>
      <div className="history-header">
        <span>history {wordCount > 0 && `(${wordCount} words)`}</span>
        {text && !isEditing && onUpdateHistory && (
          <button className="btn-history-edit" onClick={handleStartEdit} title="Edit history">
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="history-edit-container">
          <textarea
            className="history-edit-input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            style={{ fontSize: `${fontSize}px` }}
            autoFocus
          />
          <div className="history-edit-actions">
            <button className="btn-history-action btn-save" onClick={handleSaveEdit}>
              Save
            </button>
            <button className="btn-history-action btn-cancel" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : text ? (
        <div className="history-text" style={{ fontSize: `${fontSize}px` }}>
          {text.toLowerCase()}
        </div>
      ) : (
        <div className="history-placeholder" style={{ fontSize: `${fontSize}px` }}>
          history will appear here...
        </div>
      )}
    </div>
  );
}
