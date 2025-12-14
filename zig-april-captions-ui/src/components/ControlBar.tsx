import { Translations } from '../translations';

interface Props {
  isRunning: boolean;
  isLoading: boolean;
  status: string;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onClear: () => void;
  modelPath: string;
  onGenerateSummary: () => void;
  onGenerateQuestions: () => void;
  isSummaryLoading: boolean;
  isQuestionsLoading: boolean;
  hasApiKey: boolean;
  hasTranscript: boolean;
  t: Translations;
}

export function ControlBar({
  isRunning,
  isLoading,
  error,
  onStart,
  onStop,
  onClear,
  modelPath,
  onGenerateSummary,
  onGenerateQuestions,
  isSummaryLoading,
  isQuestionsLoading,
  hasApiKey,
  hasTranscript,
  t,
}: Props) {
  const canStart = !isRunning && !isLoading && modelPath;
  const canGenerateAI = hasApiKey && hasTranscript;

  return (
    <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2 flex-wrap">
        {!isRunning ? (
          <button
            className="flex-1 px-4 py-1 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors"
            onClick={onStart}
            disabled={!canStart}
          >
            {isLoading ? `${t.start}...` : t.start}
          </button>
        ) : (
          <button className="flex-1 px-4 py-1 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" onClick={onStop}>
            {t.stop}
          </button>
        )}
        <button
          className="px-4 py-1 text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onClear}
          disabled={isLoading}
        >
          {t.clear}
        </button>
        <button
          className="px-4 py-1 text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onGenerateSummary}
          disabled={!canGenerateAI || isSummaryLoading}
        >
          {isSummaryLoading ? `${t.generating}` : t.generateSummaryBtn}
        </button>
        <button
          className="px-4 py-1 text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onGenerateQuestions}
          disabled={!canGenerateAI || isQuestionsLoading}
        >
          {isQuestionsLoading ? `${t.generating}` : t.generateQuestionsBtn}
        </button>
      </div>

      {error && (
        <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
}
