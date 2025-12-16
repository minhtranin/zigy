import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCaptions } from './hooks/useCaptions';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { HistoryDisplay } from './components/HistoryDisplay';
import { AIPanel } from './components/AIPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { ControlBar } from './components/ControlBar';
import { TitleBar } from './components/TitleBar';
import { InitMeetingModal } from './components/InitMeetingModal';
import type { Settings } from './types';
import { getTranslations } from './translations';
import { generateMeetingGreeting } from './services/geminiService';
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
    // Timeline
    timeline,
    isSummaryLoading,
    isQuestionsLoading,
    generateSummaryToTimeline,
    generateQuestionsToTimeline,
    addQuestionsToTimeline,
    deleteTimelineItem,
    loadTimelineFromIdeas,
    // Context management
    chatHistoryStats,
    useContextOptimization,
    setUseContextOptimization,
    // Actions
    startCaptions,
    stopCaptions,
    clearCaptions,
    exportCaptions,
    saveSettings,
    updateHistory,
  } = useCaptions();

  // Get translations based on current language setting
  const t = getTranslations(settings.language);

  // Reload timeline after idea generation (polling approach)
  const [ideaGenerationTrigger, setIdeaGenerationTrigger] = useState(0);

  // Meeting init and greeting state
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);

  useEffect(() => {
    if (ideaGenerationTrigger > 0) {
      // Small delay to allow backend to save
      const timer = setTimeout(() => {
        loadTimelineFromIdeas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [ideaGenerationTrigger, loadTimelineFromIdeas]);

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

  // Meeting init and greeting handlers
  const handleInitMeeting = () => {
    setIsInitModalOpen(true);
  };

  const handleSaveMeetingContext = (context: string) => {
    const newSettings: Settings = {
      ...settings,
      ai: {
        ...settings.ai,
        api_key: settings.ai?.api_key || '',
        model: settings.ai?.model || 'gemini-2.5-flash',
        meeting_context: context,
      }
    };
    saveSettings(newSettings);
  };

  const handleGenerateGreeting = async () => {
    if (!settings.ai?.api_key) return;

    setIsGreetingLoading(true);
    try {
      const { title, script } = await generateMeetingGreeting(
        settings.ai.meeting_context,
        historyText,
        settings.ai.api_key,
        settings.ai.model
      );

      // Add to chat history (timeline)
      await invoke('add_chat_entry', {
        entry: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          entry_type: 'greeting',
          content: script,
          metadata: { title }
        }
      });

      // Reload timeline with a small delay to ensure backend has written the file
      setTimeout(() => {
        loadTimelineFromIdeas();
      }, 100);
    } catch (error) {
      console.error('Failed to generate greeting:', error);
    } finally {
      setIsGreetingLoading(false);
    }
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
          apiKey={settings.ai?.api_key}
          model={settings.ai?.model}
          onIdeaAdded={() => setIdeaGenerationTrigger(prev => prev + 1)}
          onQuestionsGenerated={addQuestionsToTimeline}
          translationLanguage={settings.ai?.translation_language}
          t={t}
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
        onGenerateSummary={generateSummaryToTimeline}
        onGenerateQuestions={generateQuestionsToTimeline}
        isSummaryLoading={isSummaryLoading}
        isQuestionsLoading={isQuestionsLoading}
        hasApiKey={!!settings.ai?.api_key}
        hasTranscript={captionsCount > 0}
        onInitMeeting={handleInitMeeting}
        onGenerateGreeting={handleGenerateGreeting}
        isGreetingLoading={isGreetingLoading}
        hasMeetingContext={!!settings.ai?.meeting_context}
        t={t}
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
        t={t}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Title Bar */}
      <TitleBar activeTab={activeTab} onTabChange={setActiveTab} t={t} />

      {/* Main Content Area */}
      <div className="flex flex-1 p-2 md:p-3 gap-3 min-h-0">
        {/* Left side: Content - Takes more space */}
        <div className="flex-[2] flex flex-col min-w-0 min-h-0">
          {activeTab === 'captions' ? renderCaptionsContent() : renderSettingsContent()}
        </div>

      {/* Right side: AI Panel (only shown in captions tab) - Takes less space */}
      {activeTab === 'captions' && (
        <div className="flex-[1] flex flex-col min-h-0 max-w-[600px] min-w-[400px]">
          <AIPanel
            timeline={timeline}
            onDeleteTimelineItem={deleteTimelineItem}
            onIdeaAdded={() => setIdeaGenerationTrigger(prev => prev + 1)}
            hasApiKey={!!settings.ai?.api_key}
            fontSize={settings.font_size}
            transcriptText={historyText}
            apiKey={settings.ai?.api_key || ''}
            model={settings.ai?.model || 'gemini-2.5-flash'}
            t={t}
            translationLanguage={settings.ai?.translation_language}
            chatHistoryStats={chatHistoryStats}
            useContextOptimization={useContextOptimization}
            onToggleContextOptimization={setUseContextOptimization}
          />
        </div>
      )}
      </div>

      {/* Meeting Init Modal */}
      <InitMeetingModal
        isOpen={isInitModalOpen}
        onClose={() => setIsInitModalOpen(false)}
        onSave={handleSaveMeetingContext}
        initialValue={settings.ai?.meeting_context || ''}
      />
    </div>
  );
}

export default App;
