import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SummaryState, QuestionsState, KnowledgeEntry, IdeaEntry, GeminiModel } from '../types';
import { generateIdeaScript } from '../services/geminiService';
import { X } from 'lucide-react';
import { Translations } from '../translations';

interface Tab {
  id: string;
  label: string;
}

interface QuestionBatch {
  questions: string[];
  timestamp: number;
  source: 'generated' | 'ask';
  lineContext?: string;
}

interface Props {
  summary: SummaryState;
  questions: QuestionsState;
  questionBatches: QuestionBatch[];
  onGenerateSummary: () => void;
  onClearSummary: () => void;
  onGenerateQuestions: () => void;
  onClearQuestions: () => void;
  hasApiKey: boolean;
  hasTranscript: boolean;
  fontSize: number;
  transcriptText: string;
  apiKey: string;
  model: GeminiModel;
  reloadIdeasTrigger?: number;
  t: Translations;
}


// Pre-written greeting and warm-up phrases for meetings
const examplePhrases = [
  // Greetings
  { category: 'Greetings', text: "Hi everyone, how's it going?" },
  { category: 'Greetings', text: "Hey team, good to see you all!" },
  { category: 'Greetings', text: "Good morning/afternoon everyone!" },
  { category: 'Greetings', text: "Thanks for joining today!" },

  // Small Talk
  { category: 'Small Talk', text: "How was everyone's weekend?" },
  { category: 'Small Talk', text: "Anyone have exciting plans coming up?" },
  { category: 'Small Talk', text: "How's the week treating everyone so far?" },

  // Check-in
  { category: 'Check-in', text: "Before we start, is everyone here?" },
  { category: 'Check-in', text: "Can everyone see the screen okay?" },
  { category: 'Check-in', text: "Any technical issues before we begin?" },

  // Starting
  { category: 'Starting', text: "Let's get started, shall we?" },
  { category: 'Starting', text: "Thanks for being here, let's dive in." },
  { category: 'Starting', text: "We have a lot to cover today, so let's begin." },

  // During Meeting
  { category: 'During Meeting', text: "Does anyone have questions so far?" },
  { category: 'During Meeting', text: "Let me share my screen for this part." },
  { category: 'During Meeting', text: "That's a great point, thanks for bringing that up." },

  // Ending
  { category: 'Ending', text: "I think that covers everything for today." },
  { category: 'Ending', text: "Thanks everyone for your time and input!" },
  { category: 'Ending', text: "Let's wrap up here. Have a great rest of your day!" },
];

export function AIPanel({
  summary,
  questions,
  questionBatches,
  onGenerateSummary,
  onClearSummary,
  onGenerateQuestions,
  onClearQuestions,
  hasApiKey,
  hasTranscript,
  fontSize,
  transcriptText,
  apiKey,
  model,
  reloadIdeasTrigger,
  t,
}: Props) {
  const [activeTab, setActiveTab] = useState('questions');
  const canGenerate = hasApiKey && hasTranscript;

  // Dynamic tabs based on translations
  const tabs: Tab[] = [
    { id: 'questions', label: t.questionsTab },
    { id: 'summary', label: t.summaryTab },
    { id: 'examples', label: t.examplesTab },
    { id: 'knowledge', label: t.knowledgeTab },
  ];

  // Knowledge state
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);

  // Idea section state
  const [ideaRawContent, setIdeaRawContent] = useState('');
  const [ideaCorrectedTitle, setIdeaCorrectedTitle] = useState('');
  const [ideaCorrectedScript, setIdeaCorrectedScript] = useState('');
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  // Idea history state
  const [ideaHistory, setIdeaHistory] = useState<IdeaEntry[]>([]);
  const [expandedIdeaId, setExpandedIdeaId] = useState<string | null>(null);

  // Load knowledge and ideas on mount
  useEffect(() => {
    loadKnowledge();
    loadIdeas();
  }, []);

  // Reload ideas when trigger changes and expand the newest one
  useEffect(() => {
    if (reloadIdeasTrigger !== undefined && reloadIdeasTrigger > 0) {
      loadIdeas().then((entries) => {
        if (entries.length > 0) {
          // Ideas are sorted by timestamp, newest first
          setExpandedIdeaId(entries[0].id);
        }
      });
    }
  }, [reloadIdeasTrigger]);

  const loadKnowledge = async () => {
    try {
      const entries = await invoke<KnowledgeEntry[]>('get_knowledge');
      setKnowledgeEntries(entries);
    } catch (e) {
      console.error('Failed to load knowledge:', e);
    }
  };

  const loadIdeas = async () => {
    try {
      const entries = await invoke<IdeaEntry[]>('get_ideas');
      setIdeaHistory(entries);
      return entries;
    } catch (e) {
      console.error('Failed to load ideas:', e);
      return [];
    }
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledge.trim()) return;
    setIsSaving(true);
    try {
      await invoke('add_knowledge_entry', { content: newKnowledge.trim() });
      setNewKnowledge('');
      await loadKnowledge();
    } catch (e) {
      console.error('Failed to add knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNomination = async (id: string) => {
    try {
      await invoke('toggle_knowledge_nomination', { id });
      await loadKnowledge();
    } catch (e) {
      console.error('Failed to toggle nomination:', e);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await invoke('delete_knowledge_entry', { id });
      await loadKnowledge();
      if (expandedKnowledgeId === id) setExpandedKnowledgeId(null);
    } catch (e) {
      console.error('Failed to delete knowledge:', e);
    }
  };

  const handleStartEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id);
    setEditingContent(entry.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim() || editingId === null) return;
    setIsSaving(true);
    try {
      await invoke('update_knowledge_entry', { id: editingId, content: editingContent.trim() });
      setEditingId(null);
      setEditingContent('');
      await loadKnowledge();
    } catch (e) {
      console.error('Failed to update knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Idea handlers
  const handleGenerateIdea = async () => {
    if (!ideaRawContent.trim()) return;

    setIsGeneratingIdea(true);
    setIdeaError(null);

    try {
      const knowledgeContext = knowledgeEntries
        .filter(e => e.nominated)
        .map(e => e.content)
        .join('\n\n');
      const { title, script } = await generateIdeaScript(
        ideaRawContent.trim(),
        transcriptText,
        knowledgeContext,
        apiKey,
        model
      );

      setIdeaCorrectedTitle(title);
      setIdeaCorrectedScript(script);

      // Save to backend
      await invoke('add_idea', {
        title: title,
        rawContent: ideaRawContent.trim(),
        correctedScript: script
      });

      // Clear form and reload
      setIdeaRawContent('');
      await loadIdeas();
    } catch (e) {
      setIdeaError(e instanceof Error ? e.message : 'Failed to generate script');
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleClearIdea = () => {
    setIdeaRawContent('');
    setIdeaCorrectedTitle('');
    setIdeaCorrectedScript('');
    setIdeaError(null);
  };

  const handleDeleteIdea = async (id: string) => {
    try {
      await invoke('delete_idea', { id });
      await loadIdeas();
      if (expandedIdeaId === id) setExpandedIdeaId(null);
    } catch (e) {
      console.error('Failed to delete idea:', e);
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-2 min-h-0">
      {/* Top Section: Tabs */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
        <div className="p-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'questions' && (
          <div className="p-3 flex flex-col gap-3 h-full">
            <div className="flex gap-2">
              <button
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onGenerateQuestions}
                disabled={!canGenerate || questions.isLoading}
              >
                {questions.isLoading ? t.thinking : t.suggestQuestions}
              </button>
              {questionBatches.length > 0 && (
                <button className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClearQuestions}>
                  {t.clear}
                </button>
              )}
            </div>

            {questions.error && (
              <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {questions.error}
              </div>
            )}

            {questionBatches.length > 0 ? (
              <div className="flex flex-col gap-4">
                {questionBatches.map((batch, batchIndex) => {
                  const timeStr = new Date(batch.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={batchIndex} className="flex flex-col gap-2">
                      {/* Batch header */}
                      <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          {batch.source === 'generated' ? `✨ ${t.aiSuggested}` : `🔍 ${t.askedAbout}`}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                      </div>

                      {/* Line context for "ask" batches */}
                      {batch.lineContext && (
                        <div className="text-xs italic text-gray-600 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
                          {t.about}: "{batch.lineContext}"
                        </div>
                      )}

                      {/* Questions in this batch */}
                      <div className="flex flex-col gap-2">
                        {batch.questions.map((q, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 p-2 rounded-lg ${
                              batch.source === 'generated'
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : 'bg-purple-50 dark:bg-purple-900/10 border-l-4 border-purple-500'
                            }`}
                          >
                            <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                              batch.source === 'generated'
                                ? 'bg-amber-500 text-white'
                                : 'bg-purple-500 text-white'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="text-gray-800 dark:text-gray-200 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>{q}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? t.noApiKey
                  : !hasTranscript
                  ? t.noTranscript
                  : t.suggestQuestionsHint}
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="p-3 flex flex-col gap-3 h-full">
            <div className="flex gap-2">
              <button
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onGenerateSummary}
                disabled={!canGenerate || summary.isLoading}
              >
                {summary.isLoading ? t.generating : t.generateSummary}
              </button>
              {summary.content && (
                <button className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClearSummary}>
                  {t.clear}
                </button>
              )}
            </div>

            {summary.error && (
              <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {summary.error}
              </div>
            )}

            {summary.content ? (
              <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                {summary.content}
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? t.noApiKey
                  : !hasTranscript
                  ? t.noTranscript
                  : t.generateSummaryHint}
              </div>
            )}

            {summary.lastGeneratedAt && (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-right mt-2">
                {t.generatedAt} {new Date(summary.lastGeneratedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="p-3 flex flex-col gap-4 h-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 italic pb-2 border-b border-gray-200 dark:border-gray-700" style={{ fontSize: `${fontSize}px` }}>
              {t.examplesDescription}
            </div>

            {[
              { category: 'Greetings', label: t.greetings },
              { category: 'Small Talk', label: t.smallTalk },
              { category: 'Check-in', label: t.checkIn },
              { category: 'Starting', label: t.starting },
              { category: 'During Meeting', label: t.duringMeeting },
              { category: 'Ending', label: t.ending },
            ].map(({ category, label }) => (
              <div key={category} className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {label}
                </div>
                <div className="flex flex-col gap-1">
                  {examplePhrases
                    .filter((p) => p.category === category)
                    .map((phrase, i) => (
                      <div
                        key={i}
                        className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded-md text-gray-800 dark:text-gray-200 border-l-2 border-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        style={{ fontSize: `${fontSize}px` }}
                      >
                        {phrase.text}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="p-3 flex flex-col gap-4 h-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 italic pb-2 border-b border-gray-200 dark:border-gray-700" style={{ fontSize: `${fontSize}px` }}>
              {t.knowledgeDescription}
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={t.knowledgePlaceholder}
                value={newKnowledge}
                onChange={(e) => setNewKnowledge(e.target.value)}
                rows={3}
                style={{ fontSize: `${fontSize}px` }}
              />
              <button
                className="self-end px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddKnowledge}
                disabled={!newKnowledge.trim() || isSaving}
              >
                {isSaving ? t.saving : t.save}
              </button>
            </div>

            {knowledgeEntries.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t.savedKnowledge} ({knowledgeEntries.length})
                  <span className="ml-2 text-indigo-600 dark:text-indigo-400">
                    ✓ {knowledgeEntries.filter(e => e.nominated).length} {t.nominated}
                  </span>
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {knowledgeEntries.map((entry) => (
                  <div key={entry.id} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={entry.nominated}
                        onChange={() => handleToggleNomination(entry.id)}
                        className="mt-1 w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                        title={entry.nominated ? "Nominated for AI use" : "Not nominated"}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <button
                            className="flex-1 text-left font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                            onClick={() => setExpandedKnowledgeId(expandedKnowledgeId === entry.id ? null : entry.id)}
                            style={{ fontSize: `${fontSize}px` }}
                          >
                            {entry.content.substring(0, 60)}{entry.content.length > 60 ? '...' : ''}
                          </button>
                          <button
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
                            onClick={() => handleDeleteKnowledge(entry.id)}
                            title="Delete"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        {expandedKnowledgeId === entry.id && (
                          <div className="mt-2">
                            {editingId === entry.id ? (
                              <>
                                <textarea
                                  className="w-full p-2 mb-2 border border-indigo-500 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  rows={3}
                                  style={{ fontSize: `${fontSize}px` }}
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    className="px-3 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                                    onClick={handleSaveEdit}
                                    disabled={isSaving || !editingContent.trim()}
                                  >
                                    {isSaving ? t.saving : t.save}
                                  </button>
                                  <button
                                    className="px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                  >
                                    {t.clear}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                                <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-2" style={{ fontSize: `${fontSize}px` }}>
                                  {entry.content}
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {new Date(entry.created_at).toLocaleDateString()}
                                  </span>
                                  <button
                                    className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => handleStartEdit(entry)}
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                {t.noKnowledge}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Bottom Section: Ideas */}
      <div className={`flex-1 flex flex-col border-2 border-indigo-300 dark:border-indigo-600 rounded-lg bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/30 shadow-md overflow-hidden min-h-0`}>
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto min-h-0">
            {/* Input Form */}
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y min-h-[50px] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder={t.ideasPlaceholder}
                value={ideaRawContent}
                onChange={(e) => setIdeaRawContent(e.target.value)}
                rows={2}
                style={{ fontSize: `${fontSize}px` }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleGenerateIdea();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleGenerateIdea}
                  disabled={!hasApiKey || !ideaRawContent.trim() || isGeneratingIdea}
                >
                  {isGeneratingIdea ? t.generating : t.generate}
                </button>
                {(ideaRawContent || ideaCorrectedScript) && (
                  <button
                    className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={handleClearIdea}
                  >
                    {t.clear}
                  </button>
                )}
              </div>
            </div>

            {/* Error Display */}
            {ideaError && (
              <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {ideaError}
              </div>
            )}

            {/* Current Result */}
            {ideaCorrectedScript && (
              <div className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-indigo-500">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                    {ideaCorrectedTitle}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ✨ {t.aiGenerated}
                  </div>
                </div>
                <div className="text-gray-800 dark:text-gray-200 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
                  {ideaCorrectedScript}
                </div>
              </div>
            )}

            {/* History */}
            {ideaHistory.length > 0 && (
              <div className="flex-1 pt-3 border-t border-gray-200 dark:border-gray-700 min-h-0 flex flex-col">
                <div className="flex flex-col gap-2 overflow-y-auto flex-1">
                  {ideaHistory.map((idea) => (
                    <div key={idea.id} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <button
                          className="flex-1 text-left font-semibold text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400"
                          onClick={() => setExpandedIdeaId(expandedIdeaId === idea.id ? null : idea.id)}
                          style={{ fontSize: `${fontSize}px` }}
                        >
                          {idea.title}
                        </button>
                        <button
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
                          onClick={() => handleDeleteIdea(idea.id)}
                          title="Delete"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {expandedIdeaId === idea.id && (
                        <div className="flex flex-col gap-2 mt-2 text-xs">
                          <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded">
                            <div className="font-semibold text-gray-600 dark:text-gray-400 mb-1">{t.raw}:</div>
                            <div className="text-gray-700 dark:text-gray-300" style={{ fontSize: `${fontSize}px` }}>{idea.raw_content}</div>
                          </div>
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded border-l-2 border-indigo-500">
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{t.script}:</div>
                            <div className="text-gray-800 dark:text-gray-200" style={{ fontSize: `${fontSize}px` }}>{idea.corrected_script}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
