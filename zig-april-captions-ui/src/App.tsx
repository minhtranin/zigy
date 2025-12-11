import { useEffect, useState } from 'react';
import { useCaptions } from './hooks/useCaptions';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { AIPanel } from './components/AIPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlBar } from './components/ControlBar';
import type { Settings } from './types';
import './App.css'; // Keep for global styles like scrollbar

function App() {
  const [activeTab, setActiveTab] = useState('captions');
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

  const renderCaptionsContent = () => (
    <div className="h-full flex flex-col gap-2">
      <TranscriptionDisplay
        text={currentText}
        fontSize={settings.font_size}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
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
  );

  const renderSettingsContent = () => (
    <div className="h-full overflow-auto">
      <SettingsPanel
        settings={settings}
        onSettingsChange={saveSettings}
        onExport={exportCaptions}
        captionsCount={captionsCount}
        disabled={isRunning}
        onThemeToggle={toggleTheme}
        effectiveTheme={getEffectiveTheme(settings.theme)}
      />
    </div>
  );

  return (
    <div className="flex h-screen p-2 md:p-3 gap-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Left side: Header + Content - Takes more space */}
      <div className="flex-[2] flex flex-col gap-2 min-w-0 min-h-0">
        <header className="px-2.5 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Zipy</h1>
            <div className="flex gap-0.5">
              <button
                className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 ${
                  activeTab === 'captions'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab('captions')}
              >
                Captions
              </button>
              <button
                className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 ${
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0">
          {activeTab === 'captions' ? renderCaptionsContent() : renderSettingsContent()}
        </main>
      </div>

      {/* Right side: AI Panel (only shown in captions tab) - Takes less space */}
      {activeTab === 'captions' && (
        <div className="flex-[1] flex flex-col min-h-0 max-w-[600px] min-w-[400px]">
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
      )}
    </div>
  );
}

export default App;
