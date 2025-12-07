import { useEffect, useRef } from 'react';
import './HistoryDisplay.css';

interface Props {
  text: string;
  wordCount: number;
  fontSize: number;
}

export function HistoryDisplay({ text, wordCount, fontSize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new text is added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div className="history-display" ref={containerRef}>
      <div className="history-header">
        history {wordCount > 0 && `(${wordCount} words)`}
      </div>
      {text ? (
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
