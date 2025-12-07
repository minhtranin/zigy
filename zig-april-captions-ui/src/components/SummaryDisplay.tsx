import { SummaryState, QuestionsState } from '../types';
import './SummaryDisplay.css';

interface Props {
  summary: SummaryState;
  questions: QuestionsState;
  onGenerateSummary: () => void;
  onClearSummary: () => void;
  onGenerateQuestions: () => void;
  onClearQuestions: () => void;
  hasApiKey: boolean;
  hasTranscript: boolean;
  fontSize: number;
}

export function SummaryDisplay({
  summary,
  questions,
  onGenerateSummary,
  onClearSummary,
  onGenerateQuestions,
  onClearQuestions,
  hasApiKey,
  hasTranscript,
  fontSize,
}: Props) {
  const canGenerate = hasApiKey && hasTranscript;

  return (
    <div className="ai-section">
      {/* Questions Section */}
      <div className="questions-display">
        <div className="section-header">
          <span>suggest questions</span>
          <div className="section-actions">
            <button
              className="btn-suggest"
              onClick={onGenerateQuestions}
              disabled={!canGenerate || questions.isLoading}
              title={
                !hasApiKey
                  ? 'Configure API key first'
                  : !hasTranscript
                  ? 'No transcript yet'
                  : 'Suggest questions to ask'
              }
            >
              {questions.isLoading ? 'thinking...' : 'suggest'}
            </button>
            {questions.questions.length > 0 && (
              <button className="btn-clear-section" onClick={onClearQuestions}>
                clear
              </button>
            )}
          </div>
        </div>

        {questions.error && <div className="section-error">{questions.error}</div>}

        {questions.questions.length > 0 ? (
          <div className="questions-list">
            {questions.questions.map((q, i) => (
              <div key={i} className="question-item" style={{ fontSize: `${fontSize}px` }}>
                <span className="question-number">{i + 1}</span>
                <span className="question-text">{q}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="section-placeholder" style={{ fontSize: `${fontSize}px` }}>
            {!hasApiKey
              ? 'configure gemini api key in settings...'
              : !hasTranscript
              ? 'start a transcription first...'
              : 'click "suggest" to get smart questions for the meeting...'}
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="summary-display">
        <div className="section-header">
          <span>ai summary</span>
          <div className="section-actions">
            <button
              className="btn-generate"
              onClick={onGenerateSummary}
              disabled={!canGenerate || summary.isLoading}
              title={
                !hasApiKey
                  ? 'Configure API key first'
                  : !hasTranscript
                  ? 'No transcript yet'
                  : 'Generate summary'
              }
            >
              {summary.isLoading ? 'generating...' : 'summarize'}
            </button>
            {summary.content && (
              <button className="btn-clear-section" onClick={onClearSummary}>
                clear
              </button>
            )}
          </div>
        </div>

        {summary.error && <div className="section-error">{summary.error}</div>}

        {summary.content ? (
          <div className="summary-content" style={{ fontSize: `${fontSize}px` }}>
            {summary.content}
          </div>
        ) : (
          <div className="section-placeholder" style={{ fontSize: `${fontSize}px` }}>
            {!hasApiKey
              ? 'configure gemini api key in settings...'
              : !hasTranscript
              ? 'start a transcription first...'
              : 'click "summarize" to create an ai summary...'}
          </div>
        )}

        {summary.lastGeneratedAt && (
          <div className="section-timestamp">
            generated at {new Date(summary.lastGeneratedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
