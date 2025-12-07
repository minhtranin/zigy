import { SummaryState } from '../types';
import './SummaryDisplay.css';

interface Props {
  summary: SummaryState;
  onGenerate: () => void;
  onClear: () => void;
  hasApiKey: boolean;
  hasTranscript: boolean;
  fontSize: number;
}

export function SummaryDisplay({
  summary,
  onGenerate,
  onClear,
  hasApiKey,
  hasTranscript,
  fontSize,
}: Props) {
  const canGenerate = hasApiKey && hasTranscript && !summary.isLoading;

  return (
    <div className="summary-display">
      <div className="summary-header">
        <span>ai summary</span>
        <div className="summary-actions">
          <button
            className="btn-generate"
            onClick={onGenerate}
            disabled={!canGenerate}
            title={
              !hasApiKey
                ? 'Configure API key first'
                : !hasTranscript
                ? 'No transcript yet'
                : 'Generate summary'
            }
          >
            {summary.isLoading ? 'generating...' : 'generate summary'}
          </button>
          {summary.content && (
            <button className="btn-clear-summary" onClick={onClear}>
              clear
            </button>
          )}
        </div>
      </div>

      {summary.error && <div className="summary-error">{summary.error}</div>}

      {summary.content ? (
        <div
          className="summary-content"
          style={{ fontSize: `${fontSize}px` }}
        >
          {summary.content}
        </div>
      ) : (
        <div
          className="summary-placeholder"
          style={{ fontSize: `${fontSize}px` }}
        >
          {!hasApiKey
            ? 'configure gemini api key in settings to generate summaries...'
            : !hasTranscript
            ? 'start a transcription to generate a summary...'
            : 'click "generate summary" to create an ai summary of your transcript...'}
        </div>
      )}

      {summary.lastGeneratedAt && (
        <div className="summary-timestamp">
          generated at {new Date(summary.lastGeneratedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
