import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SummaryState, QuestionsState, KnowledgeEntry, GeminiModel } from '../types';
import { generateAskResponse } from '../services/geminiService';
import { X } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  summary: SummaryState;
  questions: QuestionsState;
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
}

const tabs: Tab[] = [
  { id: 'ask', label: 'Speak' },
  { id: 'questions', label: 'Questions' },
  { id: 'summary', label: 'Summary' },
  { id: 'examples', label: 'Examples' },
  { id: 'knowledge', label: 'Knowledge' },
];

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
}: Props) {
  const [activeTab, setActiveTab] = useState('ask');
  const canGenerate = hasApiKey && hasTranscript;

  // Knowledge state
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Speak state
  const [askInput, setAskInput] = useState('');
  const [askResponse, setAskResponse] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [speakHistory, setSpeakHistory] = useState<Array<{ title: string; script: string; timestamp: number }>>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);

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
      await invoke('add_knowledge', { content: newKnowledge.trim() });
      setNewKnowledge('');
      await loadKnowledge();
    } catch (e) {
      console.error('Failed to add knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await invoke('delete_knowledge', { id });
      await loadKnowledge();
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
      await invoke('update_knowledge', { id: editingId, content: editingContent.trim() });
      setEditingId(null);
      setEditingContent('');
      await loadKnowledge();
    } catch (e) {
      console.error('Failed to update knowledge:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Ask AI handler
  const handleAsk = async () => {
    if (!askInput.trim()) return;

    setIsAsking(true);
    setAskError(null);
    setSelectedHistoryIndex(null);

    try {
      const knowledgeContext = knowledgeEntries.map((e) => e.content).join('\n\n');
      const response = await generateAskResponse(askInput.trim(), transcriptText, knowledgeContext, apiKey, model);
      setAskResponse(response);
      setSpeakHistory(prev => [{ title: askInput.trim(), script: response, timestamp: Date.now() }, ...prev].slice(0, 20));
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Failed to generate response');
    } finally {
      setIsAsking(false);
    }
  };

  const handleClearAsk = () => {
    setAskInput('');
    setAskResponse('');
    setAskError(null);
    setSelectedHistoryIndex(null);
  };

  const handleSelectHistory = (index: number) => {
    const item = speakHistory[index];
    setSelectedHistoryIndex(index);
    setAskInput(item.title);
    setAskResponse(item.script);
  };

  const handleDeleteHistory = (index: number) => {
    setSpeakHistory(prev => prev.filter((_, i) => i !== index));
    if (selectedHistoryIndex === index) {
      setSelectedHistoryIndex(null);
      setAskInput('');
      setAskResponse('');
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
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
        {activeTab === 'ask' && (
          <div className="p-3 flex flex-col gap-3 h-full">
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y min-h-[50px] focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="What do you want to talk about? (e.g., 'discuss the incident yesterday')"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                rows={2}
                style={{ fontSize: `${fontSize}px` }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleAsk}
                  disabled={!hasApiKey || !askInput.trim() || isAsking}
                >
                  {isAsking ? 'Thinking...' : 'Generate'}
                </button>
                {(askResponse || askInput) && (
                  <button className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={handleClearAsk}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {askError && (
              <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {askError}
              </div>
            )}

            {askResponse ? (
              <div className="flex flex-col gap-1.5 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-4 border-purple-500">
                <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Speaking Script:
                </div>
                <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                  {askResponse}
                </div>
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? 'Configure Gemini API key in Settings tab'
                  : 'Enter what you want to talk about and get a speaking script'}
              </div>
            )}

            {speakHistory.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  History ({speakHistory.length})
                </div>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {speakHistory.map((item, index) => (
                    <div
                      key={item.timestamp}
                      className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        selectedHistoryIndex === index
                          ? 'bg-gray-200 dark:bg-gray-700 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handleSelectHistory(index)}
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={item.title}>
                        {item.title}
                      </span>
                      <button
                        className="p-1 text-gray-500 dark:text-gray-400 rounded-full hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHistory(index);
                        }}
                        title="Delete"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="p-3 flex flex-col gap-3 h-full">
            <div className="flex gap-2">
              <button
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onGenerateQuestions}
                disabled={!canGenerate || questions.isLoading}
              >
                {questions.isLoading ? 'Thinking...' : 'Suggest Questions'}
              </button>
              {questions.questions.length > 0 && (
                <button className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClearQuestions}>
                  Clear
                </button>
              )}
            </div>

            {questions.error && (
              <div className="p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {questions.error}
              </div>
            )}

            {questions.questions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {questions.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg" style={{ fontSize: `${fontSize}px` }}>
                    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-amber-500 text-white rounded-full text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="text-gray-800 dark:text-gray-200">{q}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                {!hasApiKey
                  ? 'Configure Gemini API key in Settings tab'
                  : !hasTranscript
                  ? 'Start a transcription first'
                  : 'Click "Suggest Questions" to get smart questions for the meeting'}
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
                {summary.isLoading ? 'Generating...' : 'Generate Summary'}
              </button>
              {summary.content && (
                <button className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700" onClick={onClearSummary}>
                  Clear
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
                  ? 'Configure Gemini API key in Settings tab'
                  : !hasTranscript
                  ? 'Start a transcription first'
                  : 'Click "Generate Summary" to create an AI summary of your transcript'}
              </div>
            )}

            {summary.lastGeneratedAt && (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-right mt-2">
                Generated at {new Date(summary.lastGeneratedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="p-3 flex flex-col gap-4 h-full">
            <div className="text-sm text-gray-500 dark:text-gray-400 italic pb-2 border-b border-gray-200 dark:border-gray-700" style={{ fontSize: `${fontSize}px` }}>
              Quick phrases for meeting greetings and warm-ups
            </div>

            {['Greetings', 'Small Talk', 'Check-in', 'Starting', 'During Meeting', 'Ending'].map((category) => (
              <div key={category} className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  {category}
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
              Add your own knowledge for AI to reference in future responses
            </div>

            <div className="flex flex-col gap-2">
              <textarea
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Enter your knowledge here... (e.g., project details, team info, terminology)"
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
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            {knowledgeEntries.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Saved Knowledge ({knowledgeEntries.length})
                </div>
                {knowledgeEntries.map((entry) => (
                  <div key={entry.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-l-2 border-green-500">
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
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-transparent border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-2" style={{ fontSize: `${fontSize}px` }}>
                          {entry.content}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => handleStartEdit(entry)}
                              title="Edit"
                            >
                              Edit
                            </button>
                            <button
                              className="px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => handleDeleteKnowledge(entry.id)}
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2 text-sm text-gray-500 dark:text-gray-400 italic" style={{ fontSize: `${fontSize}px` }}>
                No knowledge saved yet. Add information above to help AI provide better responses.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
