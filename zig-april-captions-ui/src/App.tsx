import { useEffect } from 'react';
import { useCaptions } from './hooks/useCaptions';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
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
    startCaptions,
    stopCaptions,
    clearCaptions,
    exportCaptions,
    saveSettings,
  } = useCaptions();

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

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
        <TranscriptionDisplay
          text={currentText}
          fontSize={settings.font_size}
        />

        <HistoryDisplay
          text={historyText}
          wordCount={captionsCount}
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

        <SettingsPanel
          settings={settings}
          onSettingsChange={saveSettings}
          onExport={exportCaptions}
          captionsCount={captionsCount}
          disabled={isRunning}
        />
      </main>

      <footer className="app-footer">
        <span>Powered by April ASR</span>
        <span>•</span>
        <span>Built with Tauri + React</span>
      </footer>
    </div>
  );
}

export default App;
