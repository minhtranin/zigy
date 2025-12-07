import './ControlBar.css';

interface Props {
  isRunning: boolean;
  isLoading: boolean;
  status: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  modelPath: string;
}

export function ControlBar({
  isRunning,
  isLoading,
  status,
  error,
  onStart,
  onStop,
  onClear,
  modelPath,
}: Props) {
  const canStart = !isRunning && !isLoading && modelPath;

  return (
    <div className="control-bar">
      <div className="control-buttons">
        {!isRunning ? (
          <button
            className="btn-start"
            onClick={onStart}
            disabled={!canStart}
          >
            {isLoading ? 'Starting...' : 'Start Listening'}
          </button>
        ) : (
          <button className="btn-stop" onClick={onStop}>
            Stop
          </button>
        )}
        <button className="btn-clear" onClick={onClear} disabled={isLoading}>
          Clear History
        </button>
      </div>

      <div className="control-status">
        <span className={`status-indicator ${isRunning ? 'running' : ''}`} />
        <span className="status-text">{status}</span>
      </div>

      {error && (
        <div className="control-error">
          {error}
        </div>
      )}
    </div>
  );
}
