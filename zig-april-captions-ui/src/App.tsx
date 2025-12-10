import { useEffect } from 'react';
import { useCaptions } from './hooks/useCaptions';
import { TabContainer } from './components/TabContainer';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { AIPanel } from './components/AIPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlBar } from './components/ControlBar';
import type { Settings } from './types';
import './App.css'; // Keep for global styles like scrollbar

function App() {
  const {
    currentText,
    historyText,
    captionsCount,
    isRunning,
    isLoading,
    error,
    status,
    settings,
    summary,
    generateTranscriptSummary,
    clearSummary,
    questions,
    generateSuggestedQuestions,
    clearQuestions,
    startCaptions,
    stopCaptions,
    clearCaptions,
    exportCaptions,
    saveSettings,
    updateHistory,
  } = useCaptions();

  // Get effective theme considering system preference
  const getEffectiveTheme = (theme: 'light' | 'dark' | 'system'): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Apply theme for Tailwind dark mode - runs on mount and when theme changes
  // Following Tailwind CSS v4 official best practices
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      const effectiveTheme = getEffectiveTheme(settings.theme);

      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system theme changes if using 'system' theme
    // This is the official Tailwind CSS recommended approach
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();

      // Use modern event listener API
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [settings.theme]);

  // Toggle theme function
  const toggleTheme = () => {
    const currentEffective = getEffectiveTheme(settings.theme);
    const newTheme: 'light' | 'dark' = currentEffective === 'dark' ? 'light' : 'dark';
    const newSettings: Settings = { ...settings, theme: newTheme };

    // Immediately update the DOM class for instant visual feedback
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Then save settings
    saveSettings(newSettings);
  };

  // Get the icon to display
  const getThemeIcon = () => {
    const effectiveTheme = getEffectiveTheme(settings.theme);
    return effectiveTheme === 'dark' ? '☀️' : '🌙';
  };

  const tabs = [
    {
      id: 'captions',
      label: 'Captions',
      content: (
        <div className="flex gap-3 h-full min-h-0">
          <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0">
            <TranscriptionDisplay
              text={currentText}
              fontSize={settings.font_size}
            />

            <div className="flex-1 min-h-0">
              <HistoryDisplay
                text={historyText}
                wordCount={captionsCount}
                fontSize={settings.font_size}
                onUpdateHistory={updateHistory}
              />
            </div>

            <ControlBar
              isRunning={isRunning}
              isLoading={isLoading}
              status={status}
              error={error}
              onStart={startCaptions}
              onStop={stopCaptions}
              onClear={clearCaptions}
              modelPath={settings.model_path}
            />
          </div>

          <div className="w-[520px] min-w-[420px] flex flex-col min-h-0">
            <AIPanel
              summary={summary}
              questions={questions}
              onGenerateSummary={generateTranscriptSummary}
              onClearSummary={clearSummary}
              onGenerateQuestions={generateSuggestedQuestions}
              onClearQuestions={clearQuestions}
              hasApiKey={!!settings.ai?.api_key}
              hasTranscript={captionsCount > 0}
              fontSize={settings.font_size}
              transcriptText={historyText}
              apiKey={settings.ai?.api_key || ''}
              model={settings.ai?.model || 'gemini-2.5-flash'}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      content: (
        <SettingsPanel
          settings={settings}
          onSettingsChange={saveSettings}
          onExport={exportCaptions}
          captionsCount={captionsCount}
          disabled={isRunning}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col h-screen p-2 md:p-3 gap-2 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">Zipy</h1>
        <button
          onClick={toggleTheme}
          title={`Switch to ${getEffectiveTheme(settings.theme) === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          aria-label="Toggle theme"
        >
          {getThemeIcon()}
        </button>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <TabContainer tabs={tabs} defaultTab="captions" />
      </main>

      <footer className="flex justify-center items-center p-1 text-xs text-gray-500 dark:text-gray-400">
        <span>© 2025 MinhCongTran</span>
      </footer>
    </div>
  );
}

export default App;
