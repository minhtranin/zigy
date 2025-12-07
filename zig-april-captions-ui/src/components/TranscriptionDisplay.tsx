import './TranscriptionDisplay.css';

interface Props {
  text: string;
  fontSize: number;
}

export function TranscriptionDisplay({ text, fontSize }: Props) {
  return (
    <div className="transcription-display">
      <div className="transcription-header">transcription (live)</div>
      {text ? (
        <div className="transcription-text" style={{ fontSize: `${fontSize}px` }}>
          {text.toLowerCase()}
        </div>
      ) : (
        <div className="transcription-placeholder" style={{ fontSize: `${fontSize}px` }}>
          waiting for speech...
        </div>
      )}
    </div>
  );
}
