import { useEffect } from 'react';
import { useCaptions } from './hooks/useCaptions';
import { TabContainer } from './components/TabContainer';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { AIPanel } from './components/AIPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlBar } from './components/ControlBar';
import './App.css';

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

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const tabs = [
    {
      id: 'captions',
      label: 'Captions',
      content: (
        <>
          <TranscriptionDisplay
            text={currentText}
            fontSize={settings.font_size}
          />

          <HistoryDisplay
            text={historyText}
            wordCount={captionsCount}
            fontSize={settings.font_size}
            onUpdateHistory={updateHistory}
          />

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
          />

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
        </>
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
    <div className="app">
      <header className="app-header">
        <h1>Zipy</h1>
        <div className="theme-toggle">
          <button
            onClick={() => saveSettings({
              ...settings,
              theme: settings.theme === 'dark' ? 'light' : 'dark'
            })}
            title="Toggle theme"
          >
            {settings.theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <TabContainer tabs={tabs} defaultTab="captions" />
      </main>

      <footer className="app-footer">
        <span>© 2025 MinhCongTran</span>
      </footer>
    </div>
  );
}

export default App;
