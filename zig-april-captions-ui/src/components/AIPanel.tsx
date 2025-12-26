import { useState, useEffect, useRef } from 'react';
import { TimelineItem, GeminiModel, TranslationLanguage, ChatHistoryStats, TRANSLATION_LANGUAGES, Settings } from '../types';
import { translateText } from '../services/geminiService';
import { X, FileText, HelpCircle, Lightbulb, MessageCircle, Languages } from 'lucide-react';
import { Translations } from '../translations';
import { ChatPanel } from './ChatPanel';

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
  // Context monitoring props (hidden but kept for API compatibility)
  chatHistoryStats?: ChatHistoryStats | null;
  useContextOptimization?: boolean;
  onToggleContextOptimization?: (enabled: boolean) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  externalCommand?: { command: string; text: string } | null;
  onExternalCommandProcessed?: () => void;
  // Auto-summary for chat
  autoSummaryForChat?: string | null;
  onAutoSummaryProcessed?: () => void;
}

export function AIPanel({
  timeline,
  onDeleteTimelineItem,
  onIdeaAdded: _onIdeaAdded,
  hasApiKey: _hasApiKey,
  fontSize,
  transcriptText: _transcriptText,
  apiKey,
  model,
  t,
  translationLanguage,
  chatHistoryStats: _chatHistoryStats,
  useContextOptimization: _useContextOptimization = true,
  onToggleContextOptimization: _onToggleContextOptimization,
  settings,
  onSettingsChange,
  externalCommand,
  onExternalCommandProcessed,
  autoSummaryForChat,
  onAutoSummaryProcessed,
}: Props) {
  // Use stable session ID from localStorage to persist across tab switches
  const [chatSessionId] = useState(() => {
    const stored = localStorage.getItem('zigy_chat_session_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('zigy_chat_session_id', newId);
    return newId;
  });

  // Expanded timeline item ID
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  // Track previous timeline length to detect new additions
  const prevTimelineLengthRef = useRef(timeline.length);

  // Translation state for timeline items
  const [timelineTranslations, setTimelineTranslations] = useState<Map<string, string>>(new Map());
  const [translatingItemId, setTranslatingItemId] = useState<string | null>(null);

  // Auto-expand the newest timeline item when a new item is added
  useEffect(() => {
    const prevLength = prevTimelineLengthRef.current;
    const currentLength = timeline.length;

    // Check if a new item was added (length increased)
    if (currentLength > prevLength && timeline.length > 0) {
      // Sort timeline by timestamp to get the newest item
      const _sortedTimeline = [...timeline].sort((a, b) => b.timestamp - a.timestamp);
      const newestItem = _sortedTimeline[0];

      // Auto-expand the newest item
      if (newestItem) {
        setExpandedItemId(newestItem.id);
      }
    }

    // Update the ref for next comparison
    prevTimelineLengthRef.current = currentLength;
  }, [timeline]);

  // Handle translation for timeline items
  const handleTranslateTimelineItem = async (item: TimelineItem) => {
    if (!translationLanguage || translationLanguage === 'none') {
      return;
    }

    // If already translated, toggle visibility (hide it)
    if (timelineTranslations.has(item.id)) {
      setTimelineTranslations(prev => {
        const newMap = new Map(prev);
        newMap.delete(item.id);
        return newMap;
      });
      return;
    }

    setTranslatingItemId(item.id);

    try {
      const targetLanguageName = TRANSLATION_LANGUAGES[translationLanguage];

      // Get the content to translate based on item type
      let contentToTranslate = '';
      if (item.type === 'summary' || item.type === 'greeting') {
        contentToTranslate = item.content;
      } else if (item.type === 'questions') {
        contentToTranslate = item.questions.join('\n');
      } else if (item.type === 'idea') {
        contentToTranslate = item.correctedScript;
      }

      const translation = await translateText(
        contentToTranslate,
        targetLanguageName,
        apiKey,
        model
      );

      setTimelineTranslations(prev => {
        const newMap = new Map(prev);
        newMap.set(item.id, translation);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to translate timeline item:', error);
    } finally {
      setTranslatingItemId(null);
    }
  };

  // Render timeline item based on type
  // @ts-ignore - unused: kept for potential future use
  const _renderTimelineItem = (item: TimelineItem) => {
    const timeStr = new Date(item.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const isExpanded = expandedItemId === item.id;

    switch (item.type) {
      case 'summary':
        return (
          <div key={item.id} className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border-l-4 border-rose-500">
            <div className="flex items-center justify-between mb-2">
              <button
                className="flex items-center gap-2 flex-1 text-left group"
                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <FileText size={16} className="text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase group-hover:text-rose-700 dark:group-hover:text-rose-300">{t.summaryTitle}</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded disabled:opacity-50"
                  onClick={() => handleTranslateTimelineItem(item)}
                  disabled={!translationLanguage || translationLanguage === 'none' || translatingItemId === item.id}
                  title={timelineTranslations.has(item.id) ? t.hide : t.translate}
                >
                  <Languages size={14} />
                </button>
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
              <>
                <div className="mt-2 text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${fontSize}px` }}>
                  {item.content}
                </div>
                {timelineTranslations.has(item.id) && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2">
                    <div className="flex items-start gap-2">
                      <Languages size={12} className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}>
                        {timelineTranslations.get(item.id)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
              <button
                className="flex items-center gap-2 flex-1 text-left group"
                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <HelpCircle size={16} className={item.source === 'generated' ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'} />
                <span className={`text-xs font-semibold uppercase ${
                  item.source === 'generated'
                    ? 'text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300'
                    : 'text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300'
                }`}>
                  {t.questionsTitle} {item.source === 'generated' ? `• ${t.aiSuggested}` : `• ${t.askedAbout}`}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded disabled:opacity-50"
                  onClick={() => handleTranslateTimelineItem(item)}
                  disabled={!translationLanguage || translationLanguage === 'none' || translatingItemId === item.id}
                  title={timelineTranslations.has(item.id) ? t.hide : t.translate}
                >
                  <Languages size={14} />
                </button>
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
              <>
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
                {timelineTranslations.has(item.id) && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2">
                    <div className="flex items-start gap-2">
                      <Languages size={12} className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}>
                        {timelineTranslations.get(item.id)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded disabled:opacity-50"
                  onClick={() => handleTranslateTimelineItem(item)}
                  disabled={!translationLanguage || translationLanguage === 'none' || translatingItemId === item.id}
                  title={timelineTranslations.has(item.id) ? t.hide : t.translate}
                >
                  <Languages size={14} />
                </button>
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
              <>
                <div className="flex flex-col gap-2 mt-2 text-xs">
                  <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded">
                    <div className="font-semibold text-gray-600 dark:text-gray-400 mb-1">{t.raw}:</div>
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words" style={{ fontSize: `${fontSize}px`, wordWrap: 'break-word', overflowWrap: 'break-word' }}>{item.rawContent}</div>
                  </div>
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded border-l-2 border-indigo-500">
                    <div className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{t.script}:</div>
                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words" style={{ fontSize: `${fontSize}px`, wordWrap: 'break-word', overflowWrap: 'break-word' }}>{item.correctedScript}</div>
                  </div>
                </div>
                {timelineTranslations.has(item.id) && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2">
                    <div className="flex items-start gap-2">
                      <Languages size={12} className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}>
                        {timelineTranslations.get(item.id)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'greeting':
        return (
          <div key={item.id} className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <button
                className="flex items-center gap-2 flex-1 text-left group"
                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
              >
                <MessageCircle size={16} className="text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400" style={{ fontSize: `${fontSize}px` }}>
                  {item.title || 'Meeting Greeting'}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeStr}</span>
                <button
                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded disabled:opacity-50"
                  onClick={() => handleTranslateTimelineItem(item)}
                  disabled={!translationLanguage || translationLanguage === 'none' || translatingItemId === item.id}
                  title={timelineTranslations.has(item.id) ? t.hide : t.translate}
                >
                  <Languages size={14} />
                </button>
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
              <>
                <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded border-l-2 border-blue-500">
                  <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words" style={{ fontSize: `${fontSize}px`, wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    {item.content}
                  </div>
                </div>
                {timelineTranslations.has(item.id) && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-r p-2">
                    <div className="flex items-start gap-2">
                      <Languages size={12} className="text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap" style={{ fontSize: `${Math.round(fontSize * 0.9)}px` }}>
                        {timelineTranslations.get(item.id)}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
    }
  };

  // Sort timeline by timestamp descending (newest first)
  // @ts-ignore - unused: kept for potential future use
  const _sortedTimeline = [...timeline].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
        {/* Chat Panel - now the only content */}
        <ChatPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          sessionId={chatSessionId}
          fontSize={fontSize}
          t={t}
          externalCommand={externalCommand}
          onExternalCommandProcessed={onExternalCommandProcessed}
          autoSummaryForChat={autoSummaryForChat}
          onAutoSummaryProcessed={onAutoSummaryProcessed}
        />
      </div>
    </div>
  );
}
