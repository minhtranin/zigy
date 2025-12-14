import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KnowledgeEntry, TimelineItem, GeminiModel, TranslationLanguage } from '../types';
import { generateIdeaScript } from '../services/geminiService';
import { X, FileText, HelpCircle, Lightbulb } from 'lucide-react';
import { Translations } from '../translations';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  timeline: TimelineItem[];
  onDeleteTimelineItem: (id: string) => void;
  onIdeaAdded?: () => void;
  hasApiKey: boolean;
  fontSize: number;
  transcriptText: string;
  apiKey: string;
  model: GeminiModel;
  t: Translations;
  translationLanguage?: TranslationLanguage;
}

export function AIPanel({
  timeline,
  onDeleteTimelineItem,
  onIdeaAdded,
  hasApiKey,
  fontSize,
  transcriptText,
  apiKey,
  model,
  t,
  translationLanguage,
}: Props) {
  const [activeTab, setActiveTab] = useState('ideas');

  // Only 2 tabs now: Knowledge and Ideas
  const tabs: Tab[] = [
    { id: 'knowledge', label: t.knowledgeTab },
    { id: 'ideas', label: t.ideasTab },
  ];

  // Knowledge state
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);

  // Idea generation state (for Ideas tab)
  const [ideaRawContent, setIdeaRawContent] = useState('');
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  // Expanded timeline item ID
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Load knowledge on mount
  useEffect(() => {
    loadKnowledge();
  }, []);

  const loadKnowledge = async () => {
    try {
      const entries = await invoke<KnowledgeEntry[]>('get_knowledge');
      setKnowledgeEntries(entries);
    } catch (e) {
      console.error('Failed to load knowledge:', e);
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

  // Idea generation handler
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
        model,
        translationLanguage
      );

      // Save to backend
      await invoke('add_idea', {
        title: title,
        rawContent: ideaRawContent.trim(),
        correctedScript: script
      });

      // Clear form
      setIdeaRawContent('');
      setIdeaError(null);

      // Notify parent to reload timeline
      onIdeaAdded?.();
    } catch (e) {
      setIdeaError(e instanceof Error ? e.message : 'Failed to generate idea');
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const handleClearIdea = () => {
    setIdeaRawContent('');
    setIdeaError(null);
  };

  // Render timeline item based on type
  const renderTimelineItem = (item: TimelineItem) => {
    const timeStr = new Date(item.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const isExpanded = expandedItemId === item.id;

    switch (item.type) {
      case 'summary':
        return (
          <div key={item.id} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase">{t.summaryTitle}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
                  onClick={() => onDeleteTimelineItem(item.id)}
                  title="Delete"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
              {item.content}
            </div>
          </div>
        );

      case 'questions':
        return (
          <div key={item.id} className={`p-3 rounded-lg border-l-4 ${
            item.source === 'generated'
              ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500'
              : 'bg-purple-50 dark:bg-purple-900/10 border-purple-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} className={item.source === 'generated' ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'} />
                <span className={`text-xs font-semibold uppercase ${
                  item.source === 'generated' ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'
                }`}>
                  {t.questionsTitle} {item.source === 'generated' ? `• ${t.aiSuggested}` : `• ${t.askedAbout}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
                  onClick={() => onDeleteTimelineItem(item.id)}
                  title="Delete"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {item.lineContext && (
              <div className="text-xs italic text-gray-600 dark:text-gray-400 px-2 py-1 mb-2 bg-gray-100 dark:bg-gray-800 rounded">
                {t.about}: "{item.lineContext}"
              </div>
            )}
            <div className="flex flex-col gap-2">
              {item.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded">
                  <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                    item.source === 'generated'
                      ? 'bg-amber-500 text-white'
                      : 'bg-purple-500 text-white'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="text-gray-800 dark:text-gray-200 leading-relaxed flex-1" style={{ fontSize: `${fontSize}px` }}>
                    {q}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'idea':
        return (
          <div key={item.id} className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border-l-4 border-indigo-500">
            <div className="flex items-center justify-between mb-2">
              <button
                className="flex items-center gap-2 flex-1 text-left group"
                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <Lightbulb size={16} className="text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" style={{ fontSize: `${fontSize}px` }}>
                  {item.title}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded"
                  onClick={() => onDeleteTimelineItem(item.id)}
                  title="Delete"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {isExpanded && (
              <div className="flex flex-col gap-2 mt-2 text-xs">
                <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-600 dark:text-gray-400 mb-1">{t.raw}:</div>
                  <div className="text-gray-700 dark:text-gray-300" style={{ fontSize: `${fontSize}px` }}>{item.rawContent}</div>
                </div>
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded border-l-2 border-indigo-500">
                  <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{t.script}:</div>
                  <div className="text-gray-800 dark:text-gray-200 leading-relaxed" style={{ fontSize: `${fontSize}px` }}>{item.correctedScript}</div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  // Sort timeline by timestamp descending (newest first)
  const sortedTimeline = [...timeline].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
        {/* Tabs */}
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

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
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

          {activeTab === 'ideas' && (
            <div className="p-3 flex flex-col gap-3 h-full">
              {/* Idea Input Form */}
              <div className="flex flex-col gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
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
                  {ideaRawContent && (
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

              {/* Timeline */}
              {sortedTimeline.length > 0 ? (
                <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
                  {sortedTimeline.map(item => renderTimelineItem(item))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center p-4 text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                    <div className="mb-2">{t.noTimelineItems}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">{t.timelineHint}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
