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
    <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            onClick={onStart}
            disabled={!canStart}
          >
            {isLoading ? 'Starting...' : 'Start Listening'}
          </button>
        ) : (
          <button className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors" onClick={onStop}>
            Stop
          </button>
        )}
        <button
          className="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onClear}
          disabled={isLoading}
        >
          Clear History
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{status}</span>
      </div>

      {error && (
        <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
}
