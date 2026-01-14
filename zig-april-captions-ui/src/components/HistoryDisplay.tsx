import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  MessageSquare,
  Mic,
  Languages,
  Loader2,
} from 'lucide-react';
import type { GeminiModel, TranslationLanguage } from '../types';
import { TRANSLATION_LANGUAGES } from '../types';
import { Translations } from '../translations';

interface Props {
  text: string;
  wordCount: number;
  fontSize: number;
  apiKey?: string;
  model?: GeminiModel;
  onIdeaAdded?: () => void;
  onQuestionsGenerated?: (questions: string[], lineContext?: string) => void;
  translationLanguage?: TranslationLanguage;
  t: Translations;
  onAddCommandToChat?: (command: string, text: string) => void;
  onFinalizeLiveText?: () => void;
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

export function HistoryDisplay({
  text,
  wordCount,
  fontSize,
  apiKey,
  model = 'gemini-2.0-flash',
  onIdeaAdded: _onIdeaAdded,
  onQuestionsGenerated: _onQuestionsGenerated,
  translationLanguage = 'vi',
  t,
  onAddCommandToChat,
  onFinalizeLiveText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);

  const lines = text ? text.toLowerCase().split('\n').filter(line => line.trim() !== '') : [];

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  const handleAnswerClick = (index: number) => {
    onFinalizeLiveText?.(); // Finalize live text first (no-hang)
    const lineText = lines[index];
    onAddCommandToChat?.('/answer', lineText);
  };

  const handleAskClick = (index: number) => {
    onFinalizeLiveText?.(); // Finalize live text first (no-hang)
    const lineText = lines[index];

    // Get surrounding context (previous and next lines if they exist)
    const surroundingLines: string[] = [];
    if (index > 0) surroundingLines.push(lines[index - 1]);
    surroundingLines.push(lineText);
    if (index < lines.length - 1) surroundingLines.push(lines[index + 1]);

    // Create context string with priority
    const context = surroundingLines.join(' | ');
    onAddCommandToChat?.('/ask-about-line', context);
  };

  const handleTalkClick = (index: number) => {
    onFinalizeLiveText?.(); // Finalize live text first (no-hang)
    const lineText = lines[index];
    onAddCommandToChat?.('/talk', lineText);
  };

  const handleTranslateClick = async (index: number) => {
    if (!apiKey || translatingIndex !== null) return;
    
    onFinalizeLiveText?.(); // Finalize live text first (no-hang)

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
    <div className="bg-white dark:bg-[#0D1117] rounded-lg shadow-md p-3 flex flex-col h-full border border-gray-200 dark:border-[#30363D]">
      <div className="flex-shrink-0 pb-1 mb-1 border-b border-gray-200 dark:border-[#30363D] flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-400 dark:text-[#7D8590] uppercase tracking-wider">
          {t.history} {wordCount > 0 && `(${wordCount} ${t.words})`}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" ref={containerRef}>
        {lines.length > 0 ? (
          <div className="text-gray-800 dark:text-[#E6EDF3]" style={{ fontSize: `${fontSize}px` }}>
            {lines.map((line, i) => {
              return (
                <div key={i} className="group py-2 border-b border-gray-200 dark:border-[#30363D] last:border-b-0">
                  <div className="flex flex-col gap-2">
                    <div className="leading-relaxed" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                      {line}
                    </div>
                    {/* Show translation inline */}
                    {translations[i] && (
                      <div className="text-sm text-blue-600 dark:text-blue-400 italic pl-2 border-l-2 border-blue-300 dark:border-blue-500">
                        📝 {translations[i]}
                      </div>
                    )}
                    {onAddCommandToChat && (
                      <div className="flex items-center gap-2 flex-wrap transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                        <button
                          className="flex items-center gap-1 text-gray-600 hover:text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t.clarify}
                          onClick={() => handleAskClick(i)}
                          disabled={!apiKey}
                        >
                          <HelpCircle size={18} />
                          <span className="text-sm">{t.clarify}</span>
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
        ) : null}
      </div>
    </div>
  );
}
