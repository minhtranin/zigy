import { useEffect, useRef } from 'react';
import { Caption } from '../types';
import './CaptionHistory.css';

interface Props {
  captions: Caption[];
  fontSize: number;
}

export function CaptionHistory({ captions, fontSize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new captions arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [captions]);

  // Combine all caption texts into one continuous string
  const fullText = captions.map(c => c.text).join(' ');

  return (
    <div className="caption-history" ref={containerRef}>
      {captions.length === 0 ? (
        <div className="caption-history-empty">
          caption history will appear here...
        </div>
      ) : (
        <div
          className="caption-history-text"
          style={{ fontSize: `${Math.max(fontSize - 4, 14)}px` }}
        >
          {fullText}
        </div>
      )}
    </div>
  );
}
