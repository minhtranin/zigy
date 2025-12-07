import { Caption } from '../types';
import './CaptionDisplay.css';

interface Props {
  currentCaption: Caption | null;
  fontSize: number;
}

export function CaptionDisplay({ currentCaption, fontSize }: Props) {
  return (
    <div className="caption-display" style={{ fontSize: `${fontSize}px` }}>
      {currentCaption ? (
        <span className="caption-partial">{currentCaption.text}</span>
      ) : (
        <span className="caption-placeholder">waiting for speech...</span>
      )}
    </div>
  );
}
