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
  // Meeting init and greeting
  onInitMeeting: () => void;
  onGenerateGreeting: () => void;
  isGreetingLoading: boolean;
  hasMeetingContext: boolean;
  // Send commands to chat
  onAddCommandToChat?: (command: string, text?: string) => void;
}

export function ControlBar({
  isRunning,
  isLoading,
  error,
  onStart,
  onStop,
  onClear,
  modelPath,
  onGenerateSummary: _onGenerateSummary,
  onGenerateQuestions: _onGenerateQuestions,
  isSummaryLoading: _isSummaryLoading,
  isQuestionsLoading: _isQuestionsLoading,
  hasApiKey,
  hasTranscript,
  t,
  onInitMeeting,
  onGenerateGreeting: _onGenerateGreeting,
  isGreetingLoading: _isGreetingLoading,
  hasMeetingContext,
  onAddCommandToChat,
}: Props) {
  const canStart = !isRunning && !isLoading && modelPath;
  const canGenerateAI = hasApiKey && hasTranscript;
  const canGenerateGreeting = hasApiKey;

  // Send commands to chat instead of timeline
  const handleGreeting = () => {
    if (onAddCommandToChat) {
      onAddCommandToChat('/greeting', '');
    }
  };

  const handleSummary = () => {
    if (onAddCommandToChat) {
      onAddCommandToChat('/summary', '');
    }
  };

  const handleQuestions = () => {
    if (onAddCommandToChat) {
      onAddCommandToChat('/questions', '');
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex gap-2 flex-wrap">
        {/* Init Meeting Button */}
        <button
          className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${
            hasMeetingContext
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }`}
          onClick={onInitMeeting}
          title={hasMeetingContext ? 'Meeting context set - click to update' : 'Set meeting context'}
        >
          {hasMeetingContext ? '✓ Init' : 'Init'}
        </button>

        {/* Greeting Button - now sends to chat */}
        <button
          className="px-4 py-1 text-sm font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleGreeting}
          disabled={!canGenerateGreeting}
          title="Generate ice-breaker questions in chat"
        >
          {t.iceBreakers}
        </button>

        {/* Start/Stop Button */}
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
        {/* Summary Button - now sends to chat */}
        <button
          className="px-4 py-1 text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleSummary}
          disabled={!canGenerateAI}
          title="Generate meeting summary in chat"
        >
          {t.generateSummaryBtn}
        </button>
        {/* Questions Button - now sends to chat */}
        <button
          className="px-4 py-1 text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleQuestions}
          disabled={!canGenerateAI}
          title="Generate questions in chat"
        >
          {t.generateQuestionsBtn}
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
