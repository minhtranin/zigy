import { ChatHistoryStats } from '../types';

interface ContextMonitorProps {
  stats: ChatHistoryStats | null;
  useContextOptimization: boolean;
  onToggleOptimization: (enabled: boolean) => void;
}

export function ContextMonitor({
  stats,
  useContextOptimization,
  onToggleOptimization,
}: ContextMonitorProps) {
  if (!stats) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 p-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span>Context: No data</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={useContextOptimization}
              onChange={(e) => onToggleOptimization(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-xs">Optimize</span>
          </label>
        </div>
      </div>
    );
  }

  const tokenBudget = 6000;
  const usagePercent = Math.min((stats.estimated_tokens / tokenBudget) * 100, 100);
  const isOverBudget = stats.estimated_tokens > tokenBudget;

  return (
    <div className="text-xs p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
      {/* Token usage bar */}
      <div className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400 min-w-[50px]">Tokens:</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOverBudget
                ? 'bg-red-500'
                : usagePercent > 80
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <span className={`min-w-[70px] text-right ${isOverBudget ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
          {stats.estimated_tokens.toLocaleString()} / {tokenBudget.toLocaleString()}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-3">
          <span title="Total chat history entries">
            {stats.total_entries} entries
          </span>
          {stats.by_type && (
            <span className="text-gray-400 dark:text-gray-500">
              ({stats.by_type.transcript || 0} transcript, {stats.by_type.summary || 0} summaries)
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
          <input
            type="checkbox"
            checked={useContextOptimization}
            onChange={(e) => onToggleOptimization(e.target.checked)}
            className="w-3 h-3 accent-emerald-500"
          />
          <span>Smart Context</span>
        </label>
      </div>

      {/* Compression indicator */}
      {useContextOptimization && stats.estimated_tokens > 5000 && (
        <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span>Context compression active (saving ~{Math.round((1 - 18000 / stats.estimated_tokens) * 100)}% tokens)</span>
        </div>
      )}
    </div>
  );
}
