import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  MessageSquare,
  Mic,
  Languages,
  Minimize2,
  Loader2,
} from 'lucide-react';
import type { GeminiModel, TranslationLanguage } from '../types';
import { TRANSLATION_LANGUAGES } from '../types';
import { Translations } from '../translations';

interface Props {
  text: string;
  wordCount: number;
  fontSize: number;
  onUpdateHistory?: (newText: string) => void;
  apiKey?: string;
  model?: GeminiModel;
  onIdeaAdded?: () => void;
  onQuestionsGenerated?: (questions: string[], lineContext?: string) => void;
  translationLanguage?: TranslationLanguage;
  t: Translations;
  onAddCommandToChat?: (command: string, text: string) => void;
}

// Translate text using Gemini
async function translateLine(
  text: string,
  targetLanguage: string,
  apiKey: string,
  model: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Translate this text to ${targetLanguage}. Return ONLY the translation, no explanations:\n\n${text}`
        }]
      }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
    })
  });

  if (!response.ok) throw new Error('Translation failed');
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || text;
}

// Summarize transcription lines using Gemini
async function summarizeTranscript(
  lines: string[],
  apiKey: string,
  model: string
): Promise<string> {
  const text = lines.join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Summarize this meeting transcript into 1-2 concise sentences. Keep key topics, names, and decisions. This is for context retention:\n\n${text}`
        }]
      }],
      generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
    })
  });

  if (!response.ok) {
    throw new Error('Failed to summarize');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || lines.join(' ... ');
}

export function HistoryDisplay({
  text,
  wordCount,
  fontSize,
  onUpdateHistory,
  apiKey,
  model = 'gemini-2.0-flash',
  onIdeaAdded: _onIdeaAdded,
  onQuestionsGenerated: _onQuestionsGenerated,
  translationLanguage = 'vi',
  t,
  onAddCommandToChat,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCompacting, setIsCompacting] = useState(false);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);

  const lines = text ? text.toLowerCase().split('\n').filter(line => line.trim() !== '') : [];

  const handleCompact = async () => {
    if (lines.length <= 1 || !onUpdateHistory) return;

    // Compact ALL lines into 1 summary
    if (!apiKey) {
      // Fallback: simple join if no API key
      const merged = lines.join(' ... ');
      onUpdateHistory(merged);
      return;
    }

    setIsCompacting(true);
    try {
      // Use Gemini to summarize ALL lines into 1
      const summary = await summarizeTranscript(lines, apiKey, model);
      onUpdateHistory(`[Summary] ${summary}`);
    } catch (error) {
      console.error('Failed to compact with AI:', error);
      // Fallback to simple join
      const merged = lines.join(' ... ');
      onUpdateHistory(merged);
    } finally {
      setIsCompacting(false);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  const handleAnswerClick = (index: number) => {
    const lineText = lines[index];
    onAddCommandToChat?.('/answer', lineText);
  };

  const handleAskClick = (index: number) => {
    const lineText = lines[index];
    onAddCommandToChat?.('/ask', lineText);
  };

  const handleTalkClick = (index: number) => {
    const lineText = lines[index];
    onAddCommandToChat?.('/talk', lineText);
  };

  const handleTranslateClick = async (index: number) => {
    if (!apiKey || translatingIndex !== null) return;

    // If already translated, toggle off
    if (translations[index]) {
      setTranslations(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      return;
    }

    const lineText = lines[index];
    setTranslatingIndex(index);

    try {
      const languageName = TRANSLATION_LANGUAGES[translationLanguage] || 'Vietnamese';
      const translated = await translateLine(lineText, languageName, apiKey, model);
      setTranslations(prev => ({ ...prev, [index]: translated }));
    } catch (e) {
      console.error('Translation failed:', e);
    } finally {
      setTranslatingIndex(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 pb-2 mb-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t.history} {wordCount > 0 && `(${wordCount} ${t.words})`}
        </span>
        {lines.length > 2 && onUpdateHistory && (
          <button
            onClick={handleCompact}
            disabled={isCompacting}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
            title={t.compact}
          >
            {isCompacting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Minimize2 size={14} />
            )}
            <span>{isCompacting ? 'Compacting...' : t.compact}</span>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" ref={containerRef}>
        {lines.length > 0 ? (
          <div className="text-gray-800 dark:text-gray-200" style={{ fontSize: `${fontSize}px` }}>
            {lines.map((line, i) => {
              const alwaysShowActions = i >= lines.length - 3;
              const isSummary = line.startsWith('[summary]');
              return (
                <div key={i} className={`group py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${isSummary ? 'bg-indigo-50 dark:bg-indigo-900/20 -mx-4 px-4' : ''}`}>
                  <div className="flex flex-col gap-2">
                    <div className={`leading-relaxed ${isSummary ? 'text-indigo-700 dark:text-indigo-300 text-sm italic' : ''}`} style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                      {line}
                    </div>
                    {/* Show translation inline */}
                    {translations[i] && (
                      <div className="text-sm text-blue-600 dark:text-blue-400 italic pl-2 border-l-2 border-blue-300 dark:border-blue-600">
                        📝 {translations[i]}
                      </div>
                    )}
                    {onAddCommandToChat && !isSummary && (
                      <div className={`flex items-center gap-2 flex-wrap transition-opacity duration-200 ${alwaysShowActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button
                          className="flex items-center gap-1 text-gray-600 hover:text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t.ask}
                          onClick={() => handleAskClick(i)}
                          disabled={!apiKey}
                        >
                          <HelpCircle size={18} />
                          <span className="text-sm">{t.ask}</span>
                        </button>
                        <button
                          className="flex items-center gap-1 text-gray-600 hover:text-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t.answer}
                          onClick={() => handleAnswerClick(i)}
                          disabled={!apiKey}
                        >
                          <MessageSquare size={18} />
                          <span className="text-sm">{t.answer}</span>
                        </button>
                        <button
                          className="flex items-center gap-1 text-gray-600 hover:text-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t.talk}
                          onClick={() => handleTalkClick(i)}
                          disabled={!apiKey}
                        >
                          <Mic size={18} />
                          <span className="text-sm">{t.talk}</span>
                        </button>
                        <button
                          className={`flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${translations[i] ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`}
                          title={translations[i] ? t.hide : t.translate}
                          onClick={() => handleTranslateClick(i)}
                          disabled={!apiKey || translatingIndex === i}
                        >
                          {translatingIndex === i ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Languages size={18} />
                          )}
                          <span className="text-sm">{translatingIndex === i ? t.translating : (translations[i] ? t.hide : t.translate)}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500 italic text-center py-4" style={{ fontSize: `${fontSize}px` }}>
            {t.historyPlaceholder}
          </div>
        )}
      </div>
    </div>
  );
}
