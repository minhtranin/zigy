import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CaptionEvent, Settings, SummaryState, QuestionsState, TimelineItem, IdeaEntry } from '../types';
import { generateSummary, generateQuestions } from '../services/geminiService';

// Global state outside React
let globalHistory: string[] = [];  // All finalized sentences
let lastText = '';                 // Last text shown (to detect replacement)
let listenerRegistered = false;

export function useCaptions() {
  // Current live transcription (replaceable, accurate)
  const [currentText, setCurrentText] = useState<string>('');
  // History - all finalized text accumulated
  const [history, setHistory] = useState<string[]>([]);
  // Summary state
  const [summary, setSummary] = useState<SummaryState>({
    content: null,
    isLoading: false,
    error: null,
    lastGeneratedAt: null,
  });
  // Questions state
  const [questions, setQuestions] = useState<QuestionsState>({
    questions: [],
    isLoading: false,
    error: null,
    lastGeneratedAt: null,
  });

  // Timeline state (unified Ideas tab)
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isQuestionsLoading, setIsQuestionsLoading] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('ready');
  const [settings, setSettings] = useState<Settings>({
    model_path: '',
    audio_source: 'mic',
    font_size: 18,
    theme: 'dark',
    language: 'en',
  });

  // Refs for state setters
  const setCurrentTextRef = useRef(setCurrentText);
  const setHistoryRef = useRef(setHistory);
  const setIsRunningRef = useRef(setIsRunning);
  const setIsLoadingRef = useRef(setIsLoading);
  const setErrorRef = useRef(setError);
  const setStatusRef = useRef(setStatus);

  useEffect(() => {
    setCurrentTextRef.current = setCurrentText;
    setHistoryRef.current = setHistory;
    setIsRunningRef.current = setIsRunning;
    setIsLoadingRef.current = setIsLoading;
    setErrorRef.current = setError;
    setStatusRef.current = setStatus;
  });

  // Load settings and timeline on mount
  useEffect(() => {
    loadSettings();
    loadTranscript();

    // Load timeline from backend ideas
    const loadTimeline = async () => {
      try {
        const ideas = await invoke<IdeaEntry[]>('get_ideas');
        const ideaItems: TimelineItem[] = ideas.map(idea => ({
          id: idea.id,
          timestamp: idea.created_at,
          type: 'idea' as const,
          title: idea.title,
          rawContent: idea.raw_content,
          correctedScript: idea.corrected_script,
        }));
        setTimeline(ideaItems);
      } catch (e) {
        console.error('Failed to load timeline from ideas:', e);
      }
    };
    loadTimeline();
  }, []); // Only run on mount

  const loadTranscript = async () => {
    try {
      const lines = await invoke<string[]>('get_transcript');
      if (lines.length > 0) {
        globalHistory = lines;
        setHistory(lines);
      }
    } catch (e) {
      console.error('Failed to load transcript:', e);
    }
  };

  // Listen for caption events
  useEffect(() => {
    if (listenerRegistered) {
      setHistory([...globalHistory]);
      return;
    }

    listenerRegistered = true;

    const setupListener = async () => {
      await listen<CaptionEvent>('caption-event', (event) => {
        const data = event.payload;

        switch (data.type) {
          case 'ready':
            setStatusRef.current(`ready - v${data.version}`);
            setIsLoadingRef.current(false);
            break;

          case 'listening':
            setStatusRef.current(`listening (${data.source})`);
            setIsRunningRef.current(true);
            setIsLoadingRef.current(false);
            setErrorRef.current(null);
            break;

          case 'caption':
            if (data.text !== undefined && data.captionType) {
              const newText = data.text.trim();

              if (data.captionType === 'partial') {
                // Check if this is a replacement (new text doesn't start with old text)
                // This means ASR started a new sentence
                if (lastText && newText && !newText.startsWith(lastText.substring(0, Math.min(10, lastText.length)))) {
                  // Old text is being replaced - save it to history
                  const oldText = lastText.trim();
                  if (oldText) {
                    globalHistory = [...globalHistory, oldText];
                    setHistoryRef.current([...globalHistory]);

                    // Persist to backend
                    invoke('add_transcript_line', { line: oldText }).catch(e => {
                      console.error('Failed to persist:', e);
                    });
                  }
                }

                // Update current text
                lastText = newText;
                setCurrentTextRef.current(data.text);
              } else {
                // Final - add to history and clear current
                if (newText) {
                  globalHistory = [...globalHistory, newText];
                  setHistoryRef.current([...globalHistory]);

                  // Persist to backend
                  invoke('add_transcript_line', { line: newText }).catch(e => {
                    console.error('Failed to persist:', e);
                  });
                }
                lastText = '';
                setCurrentTextRef.current('');
              }
            }
            break;

          case 'warning':
            setErrorRef.current(data.message || 'Warning');
            break;

          case 'error':
            setErrorRef.current(data.message || 'An error occurred');
            setIsRunningRef.current(false);
            setIsLoadingRef.current(false);
            break;

          case 'stopped':
            setStatusRef.current('stopped');
            setIsRunningRef.current(false);
            // Save any remaining current text to history
            if (lastText && lastText.trim()) {
              const finalText = lastText.trim();
              globalHistory = [...globalHistory, finalText];
              setHistoryRef.current([...globalHistory]);
              invoke('add_transcript_line', { line: finalText }).catch(() => {});
            }
            lastText = '';
            setCurrentTextRef.current('');
            break;
        }
      });
    };

    setupListener();
    return () => {};
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await invoke<Settings>('get_settings');
      setSettings(savedSettings);
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await invoke('save_settings', { settings: newSettings });
      setSettings(newSettings);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const startCaptions = useCallback(async () => {
    if (!settings.model_path) {
      setError('please select a model file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentText('');

    try {
      await invoke('start_captions', {
        modelPath: settings.model_path,
        audioSource: settings.audio_source,
      });
    } catch (e) {
      setError(`failed to start: ${e}`);
      setIsLoading(false);
    }
  }, [settings]);

  const stopCaptions = useCallback(async () => {
    try {
      await invoke('stop_captions');
      setIsRunning(false);
    } catch (e) {
      console.error('Failed to stop:', e);
    }
  }, []);

  const clearCaptions = useCallback(async () => {
    try {
      await invoke('clear_transcript');
      globalHistory = [];
      lastText = '';
      setHistory([]);
      setCurrentText('');
      // Also clear summary and questions
      setSummary({
        content: null,
        isLoading: false,
        error: null,
        lastGeneratedAt: null,
      });
      setQuestions({
        questions: [],
        isLoading: false,
        error: null,
        lastGeneratedAt: null,
      });
      // Clear timeline (keep only persisted ideas)
      setTimeline(prev => prev.filter(item => item.type === 'idea'));
    } catch (e) {
      console.error('Failed to clear transcript:', e);
    }
  }, []);

  const exportCaptions = useCallback(async (filePath: string) => {
    try {
      await invoke('export_captions', {
        captions: globalHistory.map((text, i) => ({
          id: String(i),
          text,
          caption_type: 'final',
          timestamp: Date.now(),
        })),
        filePath,
      });
      return true;
    } catch (e) {
      setError(`failed to export: ${e}`);
      return false;
    }
  }, []);

  // Generate AI summary
  const generateTranscriptSummary = useCallback(async () => {
    if (!settings.ai?.api_key) {
      setSummary(prev => ({ ...prev, error: 'please configure your gemini api key in settings' }));
      return;
    }

    const historyText = globalHistory.join(' ');
    if (!historyText.trim()) {
      setSummary(prev => ({ ...prev, error: 'no transcript to summarize' }));
      return;
    }

    setSummary(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const content = await generateSummary(
        historyText,
        settings.ai.api_key,
        settings.ai.model || 'gemini-2.5-flash'
      );
      setSummary({
        content,
        isLoading: false,
        error: null,
        lastGeneratedAt: Date.now(),
      });
    } catch (e) {
      setSummary(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : 'failed to generate summary',
      }));
    }
  }, [settings.ai]);

  const clearSummary = useCallback(() => {
    setSummary({
      content: null,
      isLoading: false,
      error: null,
      lastGeneratedAt: null,
    });
  }, []);

  // Generate suggested questions
  const generateSuggestedQuestions = useCallback(async () => {
    if (!settings.ai?.api_key) {
      setQuestions(prev => ({ ...prev, error: 'please configure your gemini api key in settings' }));
      return;
    }

    const historyText = globalHistory.join(' ');
    if (!historyText.trim()) {
      setQuestions(prev => ({ ...prev, error: 'no transcript to analyze' }));
      return;
    }

    setQuestions(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const suggestedQuestions = await generateQuestions(
        historyText,
        settings.ai.api_key,
        settings.ai.model || 'gemini-2.5-flash'
      );
      setQuestions({
        questions: suggestedQuestions,
        isLoading: false,
        error: null,
        lastGeneratedAt: Date.now(),
      });
    } catch (e) {
      setQuestions(prev => ({
        ...prev,
        isLoading: false,
        error: e instanceof Error ? e.message : 'failed to generate questions',
      }));
    }
  }, [settings.ai]);

  const clearQuestions = useCallback(() => {
    setQuestions({
      questions: [],
      isLoading: false,
      error: null,
      lastGeneratedAt: null,
    });
  }, []);

  // Load timeline from backend ideas
  const loadTimelineFromIdeas = useCallback(async () => {
    try {
      const ideas = await invoke<IdeaEntry[]>('get_ideas');
      const ideaItems: TimelineItem[] = ideas.map(idea => ({
        id: idea.id,
        timestamp: idea.created_at,
        type: 'idea' as const,
        title: idea.title,
        rawContent: idea.raw_content,
        correctedScript: idea.corrected_script,
      }));
      setTimeline(ideaItems);
    } catch (e) {
      console.error('Failed to load timeline from ideas:', e);
    }
  }, []);

  // Generate summary and add to timeline
  const generateSummaryToTimeline = useCallback(async () => {
    if (!settings.ai?.api_key) {
      setError('Please configure your Gemini API key in Settings');
      return;
    }

    const historyText = globalHistory.join(' ');
    if (!historyText.trim()) {
      setError('No transcript to summarize');
      return;
    }

    setIsSummaryLoading(true);

    try {
      const content = await generateSummary(
        historyText,
        settings.ai.api_key,
        settings.ai.model || 'gemini-2.5-flash'
      );

      const summaryItem: TimelineItem = {
        id: `summary-${Date.now()}`,
        timestamp: Date.now(),
        type: 'summary',
        content,
      };

      setTimeline(prev => [summaryItem, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary');
    } finally {
      setIsSummaryLoading(false);
    }
  }, [settings.ai]);

  // Generate questions and add to timeline
  const generateQuestionsToTimeline = useCallback(async () => {
    if (!settings.ai?.api_key) {
      setError('Please configure your Gemini API key in Settings');
      return;
    }

    const historyText = globalHistory.join(' ');
    if (!historyText.trim()) {
      setError('No transcript to analyze');
      return;
    }

    setIsQuestionsLoading(true);

    try {
      const suggestedQuestions = await generateQuestions(
        historyText,
        settings.ai.api_key,
        settings.ai.model || 'gemini-2.5-flash'
      );

      const questionsItem: TimelineItem = {
        id: `questions-${Date.now()}`,
        timestamp: Date.now(),
        type: 'questions',
        questions: suggestedQuestions,
        source: 'generated',
      };

      setTimeline(prev => [questionsItem, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate questions');
    } finally {
      setIsQuestionsLoading(false);
    }
  }, [settings.ai]);

  // Add questions to timeline (from Ask button)
  const addQuestionsToTimeline = useCallback((questions: string[], lineContext?: string) => {
    const questionsItem: TimelineItem = {
      id: `questions-ask-${Date.now()}`,
      timestamp: Date.now(),
      type: 'questions',
      questions,
      source: 'ask',
      lineContext,
    };

    setTimeline(prev => [questionsItem, ...prev]);
  }, []);

  // Delete timeline item
  const deleteTimelineItem = useCallback(async (id: string) => {
    // Find the item to check if it's an idea
    const item = timeline.find(item => item.id === id);

    if (item?.type === 'idea') {
      // Delete from backend
      try {
        await invoke('delete_idea', { id });
      } catch (e) {
        console.error('Failed to delete idea from backend:', e);
        return;
      }
    }

    // Remove from timeline
    setTimeline(prev => prev.filter(item => item.id !== id));
  }, [timeline]);

  // Update history manually (for editing)
  const updateHistory = useCallback(async (newText: string) => {
    try {
      // Split the text back into lines (by newlines)
      const lines = newText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Update backend
      await invoke('update_transcript', { lines });

      // Update local state
      globalHistory = lines;
      setHistory(lines);
    } catch (e) {
      console.error('Failed to update transcript:', e);
    }
  }, []);

  // Full history text for display (each entry on new line)
  const historyText = history.join('\n');
  const wordCount = historyText.trim() ? historyText.trim().split(/\s+/).length : 0;

  return {
    // Current live transcription (accurate, replaceable)
    currentText,
    // Full history text
    historyText,
    // History as array
    history,
    captionsCount: wordCount,
    isRunning,
    isLoading,
    error,
    status,
    settings,
    // Summary
    summary,
    generateTranscriptSummary,
    clearSummary,
    // Questions
    questions,
    generateSuggestedQuestions,
    clearQuestions,
    // Timeline
    timeline,
    isSummaryLoading,
    isQuestionsLoading,
    generateSummaryToTimeline,
    generateQuestionsToTimeline,
    addQuestionsToTimeline,
    deleteTimelineItem,
    loadTimelineFromIdeas,
    // Actions
    startCaptions,
    stopCaptions,
    clearCaptions,
    exportCaptions,
    saveSettings,
    setError,
    updateHistory,
  };
}
