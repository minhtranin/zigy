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

  const handleTalkSuggestions = () => {
    if (onAddCommandToChat) {
      onAddCommandToChat('/talk-suggestions', '');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 p-3 bg-white dark:bg-[#0D1117] rounded-lg border border-gray-200 dark:border-[#30363D]">
      <div className="flex gap-1.5 flex-wrap items-center">
        {/* Primary Controls - Start/Stop first */}
        {!isRunning ? (
          <button
            className="px-4 py-2 text-sm font-semibold text-white bg-green-400 dark:bg-green-500 rounded-md hover:bg-green-500 dark:hover:bg-green-400 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors shadow-sm"
            onClick={onStart}
            disabled={!canStart}
          >
            {isLoading ? `${t.start}...` : t.start}
          </button>
        ) : (
          <button
            className="px-4 py-2 text-sm font-semibold text-white bg-red-400 dark:bg-red-500 rounded-md hover:bg-red-500 dark:hover:bg-red-400 transition-colors shadow-sm"
            onClick={onStop}
          >
            {t.stop}
          </button>
        )}

        <button
          className="px-3 py-2 text-sm font-semibold bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] rounded-md hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={onClear}
          disabled={isLoading}
        >
          {t.clear}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-300 dark:bg-[#30363D]"></div>

        {/* AI Features - consistent slate color for all buttons except Start/Stop */}
        <button
          className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
            hasMeetingContext
              ? 'bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700 hover:bg-emerald-300 dark:hover:bg-emerald-900/60'
              : 'bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] hover:bg-slate-300 dark:hover:bg-[#30363D]'
          }`}
          onClick={onInitMeeting}
          title={hasMeetingContext ? 'Meeting context set - click to update' : 'Set meeting context'}
        >
          {hasMeetingContext ? '✓ Init' : 'Init'}
        </button>

        <button
          className="px-3 py-2 text-sm font-semibold bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] rounded-md hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleGreeting}
          disabled={!canGenerateGreeting}
          title="Generate ice-breaker questions in chat"
        >
          {t.iceBreakers}
        </button>

        <button
          className="px-3 py-2 text-sm font-semibold bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] rounded-md hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleTalkSuggestions}
          disabled={!canGenerateAI}
          title="Get short talking points about recent discussion"
        >
          Talk
        </button>

        <button
          className="px-3 py-2 text-sm font-semibold bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] rounded-md hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={handleSummary}
          disabled={!canGenerateAI}
          title="Generate meeting summary in chat"
        >
          {t.generateSummaryBtn}
        </button>

        <button
          className="px-3 py-2 text-sm font-semibold bg-slate-200 dark:bg-[#21262D] text-slate-800 dark:text-[#E6EDF3] border border-slate-300 dark:border-[#30363D] rounded-md hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
