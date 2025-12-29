import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CaptionEvent, Settings, SummaryState, QuestionsState, TimelineItem, IdeaEntry, ChatHistoryStats, ChatHistoryEntry } from '../types';
import { generateSummary, generateQuestions, generateSummaryWithContext, generateQuestionsWithContext } from '../services/geminiService';
import { addChatEntry, getChatHistoryStats, createSessionSnapshot } from '../services/contextService';

// Global state outside React
let globalHistory: string[] = [];  // All finalized sentences
let lastText = '';                 // Last text shown (to detect replacement)
let listenerRegistered = false;
let silenceTimer: ReturnType<typeof setTimeout> | null = null;  // Timer for auto-move to history
let autoSummaryInProgress = false;  // Prevent multiple auto-summary triggers

// Auto-summary threshold (in words)
const AUTO_SUMMARY_WORD_THRESHOLD = 1000;

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

  // Chat history stats for context monitoring
  const [chatHistoryStats, setChatHistoryStats] = useState<ChatHistoryStats | null>(null);
  const [useContextOptimization, setUseContextOptimization] = useState(true);

  // Auto-summary message to be shown in chat
  const [autoSummaryForChat, setAutoSummaryForChat] = useState<string | null>(null);

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

    // Check for bundled model and set as default if no model is selected
    const checkBundledModel = async () => {
      try {
        const bundledPath = await invoke<string | null>('get_bundled_model_path');
        if (bundledPath) {
          console.log('Found bundled model:', bundledPath);
          // Load settings to check if model_path is already set
          const currentSettings = await invoke<Settings>('get_settings');
          if (!currentSettings.model_path) {
            console.log('No model set, using bundled model');
            await invoke('save_settings', {
              settings: { ...currentSettings, model_path: bundledPath }
            });
            // Reload settings to pick up the bundled model
            loadSettings();
          }
        }
      } catch (e) {
        console.error('Failed to check for bundled model:', e);
      }
    };
    checkBundledModel();

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

    // Load chat history stats
    const loadStats = async () => {
      try {
        const stats = await getChatHistoryStats();
        setChatHistoryStats(stats);
      } catch (e) {
        console.error('Failed to load chat history stats:', e);
      }
    };
    loadStats();
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

              // Clear any existing silence timer
              if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
              }

              if (data.captionType === 'partial') {
                // Check if this is a replacement (new text doesn't start with old text)
                // This means ASR started a new sentence
                if (lastText && newText && !newText.startsWith(lastText.substring(0, Math.min(10, lastText.length)))) {
                  // Old text is being replaced - save it to history
                  const oldText = lastText.trim();
                  if (oldText) {
                    globalHistory = [...globalHistory, oldText];
                    setHistoryRef.current([...globalHistory]);

                    // Persist to backend (both transcript and chat history)
                    invoke('add_transcript_line', { line: oldText }).catch(e => {
                      console.error('Failed to persist:', e);
                    });
                    // Also save to chat history for context management
                    addChatEntry('transcript', oldText).catch(e => {
                      console.error('Failed to save to chat history:', e);
                    });
                  }
                }

                // Update current text
                lastText = newText;
                setCurrentTextRef.current(data.text);

                // Start silence timer - move to history after 2 seconds of no new text
                if (newText) {
                  silenceTimer = setTimeout(() => {
                    if (lastText && lastText.trim()) {
                      const textToMove = lastText.trim();
                      globalHistory = [...globalHistory, textToMove];
                      setHistoryRef.current([...globalHistory]);

                      // Persist to backend
                      invoke('add_transcript_line', { line: textToMove }).catch(e => {
                        console.error('Failed to persist:', e);
                      });
                      addChatEntry('transcript', textToMove).catch(e => {
                        console.error('Failed to save to chat history:', e);
                      });

                      lastText = '';
                      setCurrentTextRef.current('');
                    }
                    silenceTimer = null;
                  }, 2000);  // 2 seconds of silence
                }
              } else {
                // Final - add to history and clear current
                if (newText) {
                  globalHistory = [...globalHistory, newText];
                  setHistoryRef.current([...globalHistory]);

                  // Persist to backend (both transcript and chat history)
                  invoke('add_transcript_line', { line: newText }).catch(e => {
                    console.error('Failed to persist:', e);
                  });
                  // Also save to chat history for context management
                  addChatEntry('transcript', newText).catch(e => {
                    console.error('Failed to save to chat history:', e);
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
      // Create a session snapshot in background (don't block UI)
      if (globalHistory.length > 0 && settings.ai?.api_key) {
        createSessionSnapshot(
          settings.ai.api_key,
          settings.ai.model || 'gemini-2.5-flash'
        ).then(() => {
          console.log('Created session snapshot');
        }).catch((e) => {
          console.error('Failed to create session snapshot:', e);
        });
      }

      // Clear UI immediately
      globalHistory = [];
      lastText = '';
      setHistory([]);
      setCurrentText('');

      // Clear backend (must await to prevent old data from reappearing)
      await Promise.all([
        invoke('clear_transcript'),
        invoke('clear_chat_history'),
      ]);
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
      // Reset chat history stats
      setChatHistoryStats(null);
    } catch (e) {
      console.error('Failed to clear transcript:', e);
    }
  }, [settings.ai]);

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

  // Load timeline from backend chat history (all types: ideas, summaries, questions, greetings)
  const loadTimelineFromIdeas = useCallback(async () => {
    try {
      // Load ideas from the old ideas file
      const ideas = await invoke<IdeaEntry[]>('get_ideas');
      const ideaItems: TimelineItem[] = ideas.map(idea => ({
        id: idea.id,
        timestamp: idea.created_at,
        type: 'idea' as const,
        title: idea.title,
        rawContent: idea.raw_content,
        correctedScript: idea.corrected_script,
      }));

      // Load from chat history (summaries, questions, greetings)
      const chatHistory = await invoke<ChatHistoryEntry[]>('get_chat_history', {
        since: null,
        limit: null
      });

      // Convert chat history entries to timeline items
      const chatItems: TimelineItem[] = [];

      for (const entry of chatHistory) {
        if (entry.entry_type === 'summary') {
          chatItems.push({
            id: entry.id,
            timestamp: entry.timestamp,
            type: 'summary',
            content: entry.content,
          });
        } else if (entry.entry_type === 'greeting') {
          chatItems.push({
            id: entry.id,
            timestamp: entry.timestamp,
            type: 'greeting',
            title: entry.metadata?.title as string | undefined,
            content: entry.content,
          });
        } else if (entry.entry_type === 'question') {
          // Questions from the Questions button (saved to chat history)
          const questions = entry.metadata?.questions as string[] | undefined;
          if (questions && Array.isArray(questions)) {
            chatItems.push({
              id: entry.id,
              timestamp: entry.timestamp,
              type: 'questions',
              questions,
              source: 'generated',
            });
          }
        }
      }

      // Merge all items and sort by timestamp
      const allItems = [...ideaItems, ...chatItems];
      setTimeline(allItems);
    } catch (e) {
      console.error('Failed to load timeline:', e);
    }
  }, []);

  // Generate summary and add to timeline (always uses context - same as auto-summary)
  const generateSummaryToTimeline = useCallback(async () => {
    if (!settings.ai?.api_key) {
      setError('Please configure your Gemini API key in Settings');
      return;
    }

    setIsSummaryLoading(true);

    try {
      // Always use context-aware version (includes old summaries via snapshot)
      const content = await generateSummaryWithContext(
        settings.ai.api_key,
        settings.ai.model || 'gemini-2.5-flash',
        settings.ai.meeting_context
      );

      const summaryContent = `[Manual] ${content}`;

      const summaryItem: TimelineItem = {
        id: `summary-${Date.now()}`,
        timestamp: Date.now(),
        type: 'summary',
        content: summaryContent,
      };

      setTimeline(prev => [summaryItem, ...prev]);

      // Send to chat so user can ask questions about it
      await addChatEntry('summary', summaryContent);
      setAutoSummaryForChat(summaryContent);

      // Update chat history stats
      const stats = await getChatHistoryStats();
      setChatHistoryStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary');
    } finally {
      setIsSummaryLoading(false);
    }
  }, [settings.ai]);

  // Generate questions and add to timeline (with optional context optimization)
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
      let suggestedQuestions: string[];

      if (useContextOptimization) {
        // Use context-aware version (token optimized)
        suggestedQuestions = await generateQuestionsWithContext(
          settings.ai.api_key,
          settings.ai.model || 'gemini-2.5-flash',
          settings.ai.meeting_context
        );
      } else {
        // Use original version (full transcript)
        suggestedQuestions = await generateQuestions(
          historyText,
          settings.ai.api_key,
          settings.ai.model || 'gemini-2.5-flash'
        );
        // Save to chat history manually since original doesn't do it
        await addChatEntry('question', suggestedQuestions.join('\n'), { source: 'generated' });
      }

      const questionsItem: TimelineItem = {
        id: `questions-${Date.now()}`,
        timestamp: Date.now(),
        type: 'questions',
        questions: suggestedQuestions,
        source: 'generated',
      };

      setTimeline(prev => [questionsItem, ...prev]);

      // Update chat history stats
      const stats = await getChatHistoryStats();
      setChatHistoryStats(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate questions');
    } finally {
      setIsQuestionsLoading(false);
    }
  }, [settings.ai, useContextOptimization]);

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

  // Auto-summary when word count exceeds threshold
  useEffect(() => {
    const triggerAutoSummary = async () => {
      if (
        wordCount >= AUTO_SUMMARY_WORD_THRESHOLD &&
        !autoSummaryInProgress &&
        settings.ai?.api_key &&
        globalHistory.length > 0
      ) {
        autoSummaryInProgress = true;
        console.log(`Auto-summary triggered at ${wordCount} words`);

        try {
          // Generate summary to timeline
          const content = await generateSummaryWithContext(
            settings.ai.api_key,
            settings.ai.model || 'gemini-2.5-flash',
            settings.ai.meeting_context
          );

          const summaryContent = `[Auto] ${content}`;

          const summaryItem: TimelineItem = {
            id: `auto-summary-${Date.now()}`,
            timestamp: Date.now(),
            type: 'summary',
            content: summaryContent,
          };

          setTimeline(prev => [summaryItem, ...prev]);

          // Send summary to chat so user can ask questions about it
          await addChatEntry('summary', summaryContent);
          setAutoSummaryForChat(summaryContent);

          // Create snapshot and clear (reuse clearCaptions logic but without the snapshot call since we just created one)
          await createSessionSnapshot(
            settings.ai.api_key,
            settings.ai.model || 'gemini-2.5-flash'
          );

          // Clear UI and backend
          globalHistory = [];
          lastText = '';
          setHistory([]);
          setCurrentText('');

          await Promise.all([
            invoke('clear_transcript'),
            invoke('clear_chat_history'),
          ]);

          console.log('Auto-summary completed and transcript cleared');
        } catch (e) {
          console.error('Auto-summary failed:', e);
        } finally {
          autoSummaryInProgress = false;
        }
      }
    };

    triggerAutoSummary();
  }, [wordCount, settings.ai?.api_key, settings.ai?.model]);

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
    // Context management
    chatHistoryStats,
    useContextOptimization,
    setUseContextOptimization,
    // Auto-summary for chat
    autoSummaryForChat,
    clearAutoSummaryForChat: () => setAutoSummaryForChat(null),
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
