import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Send, Loader2, RefreshCw, MessageCircle, Languages, Globe, Info } from 'lucide-react';
import { ChatMessage, ChatCommandType, Settings, GeminiModel } from '../types';
import { Translations } from '../translations';
import { 
  generateSummaryWithContext,
  detectChatIntent,
  extractSearchKeywords,
  getAdaptiveContextLimit,
  getKnowledgeInstruction,
  INFO_SYSTEM_PROMPT,
  ChatIntent
} from '../services/geminiService';

// Translate text using Gemini
async function translateText(
  text: string,
  targetLanguage: string,
  apiKey: string,
  model: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Pro models need more tokens due to thinking overhead
  const isPro = model.includes('pro');
  const maxTokens = isPro ? 2048 : 512;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Translate this text to ${targetLanguage}. Return ONLY the translation, no explanations:\n\n${text}`
        }]
      }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 }
    })
  });

  if (!response.ok) throw new Error('Translation failed');
  const data = await response.json();
  
  // Handle empty response (common with Pro model when tokens exhausted)
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!result && data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new Error('Translation too long, try shorter text');
  }
  return result || text;
}

interface ChatPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  sessionId: string;
  fontSize: number;
  t: Translations;
  externalCommand?: { command: string; text: string } | null;
  onExternalCommandProcessed?: () => void;
  autoSummaryForChat?: string | null;
  onAutoSummaryProcessed?: () => void;
}

interface ChatSession {
  messages: ChatMessage[];
  summary: string;
  lastCompactedAt: number;
}

interface PromptSuggestion {
  label: string;
  prompt: string;
  icon?: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function summarizeMessages(
  messages: ChatMessage[],
  apiKey: string,
  model: string
): Promise<string> {
  if (messages.length === 0) return '';

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Summarize this conversation in 2-3 sentences, capturing the key points and any decisions made:\n\n${conversationText}`
        }]
      }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.3 }
    })
  });

  if (!response.ok) return '';
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Generate dynamic suggestions based on transcript context and chat history
async function generateDynamicSuggestions(
  transcript: string,
  apiKey: string,
  model: string,
  appLanguage: 'en' | 'vi' = 'en',
  recentMessages: ChatMessage[] = []
): Promise<PromptSuggestion[]> {
  if (!transcript || !apiKey) return [];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // For non-English, we need both display label (in app language) and English prompt
  const needsTranslation = appLanguage !== 'en';

  // Build context including recent chat to avoid redundant suggestions
  const recentChat = recentMessages.slice(-4).map(m => 
    `${m.role}: ${m.content.substring(0, 80)}`
  ).join('\n');

  const contextText = `Recent Transcript (what's being discussed):
${transcript.slice(-800)}

${recentChat ? `Recent Chat (what user already discussed - AVOID suggesting similar topics):
${recentChat}` : ''}`;

  const prompt = needsTranslation
    ? `Based on the context below, suggest 3 NEW conversation directions (max 6 words each).

IMPORTANT RULES:
- Suggest things user HASN'T already discussed in recent chat
- Focus on unexplored aspects, follow-up angles, or different perspectives
- Make them ACTION REQUESTS, not literal phrases to say
- Be specific to the actual content being discussed

Return JSON array with:
- "label": Vietnamese for display (short, 3-5 words)
- "prompt": English action request

${contextText}

Example: [{"label": "Hỏi về rủi ro", "prompt": "Ask about potential risks"}, {"label": "Đề xuất thay thế", "prompt": "Suggest an alternative approach"}]`
    : `Based on the context below, suggest 3 NEW conversation directions (max 6 words each).

IMPORTANT RULES:
- Suggest things user HASN'T already discussed in recent chat
- Focus on unexplored aspects, follow-up angles, or contrarian views
- Make them ACTION REQUESTS that work with full context
- Be specific to the actual topic being discussed

Good examples:
- "Challenge that assumption"
- "Ask about edge cases"
- "Explore the downsides"
- "Request a concrete example"
- "Clarify the timeline"

Bad examples:
- Generic phrases like "Tell me more" (too vague)
- Things already covered in recent chat

${contextText}

Return ONLY a JSON array of strings. Example: ["Challenge the proposed approach", "Ask about budget constraints", "Suggest a phased rollout"]`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.8 }
    })
  });

  if (!response.ok) return [];

  try {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);

      if (needsTranslation) {
        // Expecting array of {label, prompt} objects
        return parsed.slice(0, 3).map((item: { label: string; prompt: string }, i: number) => ({
          label: item.label || item.prompt,
          prompt: item.prompt,
          icon: ['💡', '🎯', '✨'][i] || '💬'
        }));
      } else {
        // English: simple string array
        return parsed.slice(0, 3).map((s: string, i: number) => ({
          label: s,
          prompt: s,
          icon: ['💡', '🎯', '✨'][i] || '💬'
        }));
      }
    }
  } catch {
    // Parsing failed
  }
  return [];
}

async function callGeminiAPI(
  message: string,
  context: string,
  session: ChatSession,
  apiKey: string,
  model: string,
  chatMode: 'script' | 'info' | 'talk' = 'script',
  useExternalKnowledge: boolean = false
): Promise<string> {
  // Build knowledge instruction based on toggle
  const knowledgeInstruction = getKnowledgeInstruction(useExternalKnowledge);

  const baseInstruction = `You are a highly intelligent personal meeting/interview assistant. Your role is to help the user speak confidently and professionally in real-time conversations.

${knowledgeInstruction}

CRITICAL RULES - MUST FOLLOW:
1. ALWAYS generate responses in FIRST PERSON that the user can READ ALOUD directly
   ✓ "I'm a fullstack developer with 5 years of experience..."
   ✗ "You are a developer..." or "The user is..."

2. NEVER start with filler phrases like:
   ✗ "You're absolutely right..."
   ✗ "That's a great point..."
   ✗ "Of course!"
   Just give the direct script they can say.

3. Keep responses concise (2-4 sentences) unless explicitly asked for detail

4. When user corrects you, just incorporate it naturally - no acknowledgment needed

5. When using external knowledge, generate speaking scripts that explain topics naturally, as if the user is knowledgeable about it
   - For technical topics: provide clear, concise explanations in first person
   - Don't say "I don't see X in my knowledge" - if external knowledge is enabled, USE IT to generate the script
   - Reference the user's knowledge base ONLY when directly relevant

6. When external knowledge is DISABLED, reference only the user's knowledge base and meeting context

Remember: You ARE the user speaking. Give them words they can say directly.`;

  const talkModeInstruction = `${baseInstruction}

TALK MODE ACTIVE:
The user is writing in their native language or broken English. Your job is to:
1. Understand their meaning and intent
2. Correct any grammar or language issues
3. Translate to natural, professional English they can say directly
4. Make it sound fluent and appropriate for the meeting context
5. Keep the same meaning but make it sound native

Example input: "tôi nghĩ GC thật sự quan trọng cho việc kết nối với client"
Example output: "I believe garbage collection is really important for maintaining connections with clients, especially when dealing with large datasets."`;

  // Select system instruction based on chat mode
  let systemInstruction: string;
  if (chatMode === 'info') {
    // INFO mode: factual answers, add knowledge instruction
    systemInstruction = `${INFO_SYSTEM_PROMPT}\n\n${knowledgeInstruction}`;
  } else if (chatMode === 'talk') {
    systemInstruction = talkModeInstruction;
  } else {
    systemInstruction = baseInstruction;
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  if (context) {
    contents.push({ role: 'user', parts: [{ text: `MY BACKGROUND & CURRENT MEETING:\n${context}` }] });
    contents.push({ role: 'model', parts: [{ text: chatMode === 'info' ? 'Ready to answer your questions.' : 'Ready to help you speak confidently.' }] });
  }

  if (session.summary) {
    contents.push({ role: 'user', parts: [{ text: `PREVIOUS CONVERSATION:\n${session.summary}` }] });
    contents.push({ role: 'model', parts: [{ text: 'Got it.' }] });
  }

  const recentMessages = session.messages.slice(-6);
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Adjust generation config based on chat mode
  // Note: Gemini 2.5 Pro uses "thinking tokens" internally, so needs higher maxOutputTokens
  const isPro = model.includes('pro');
  const baseTokens = isPro ? 2048 : 512;  // Pro needs more for thinking
  const scriptTokens = isPro ? 4096 : 1024;

  const generationConfig = chatMode === 'info'
    ? { maxOutputTokens: baseTokens, temperature: 0.3, topP: 0.8 }
    : { maxOutputTokens: scriptTokens, temperature: 0.7 };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  
  // Debug: log full response for troubleshooting
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.warn('Gemini API response structure:', JSON.stringify(data, null, 2));
    
    // Check for blocked response
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error('Response blocked by safety filters. Try rephrasing your question.');
    }
    if (data.candidates?.[0]?.finishReason === 'RECITATION') {
      throw new Error('Response blocked due to recitation policy. Try a different question.');
    }
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Prompt blocked: ${data.promptFeedback.blockReason}`);
    }
    // Check if response is empty due to other reasons
    if (data.candidates?.length === 0) {
      throw new Error('No response generated. The model may be overloaded, try again.');
    }
  }
  
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Default suggestions - more options
const DEFAULT_SUGGESTIONS: PromptSuggestion[] = [
  { label: 'Introduce myself', prompt: 'Help me introduce myself professionally', icon: '👋' },
  { label: 'Summarize meeting', prompt: 'Summarize the current meeting discussion', icon: '📝' },
  { label: 'Questions to ask', prompt: 'Suggest smart questions I can ask', icon: '❓' },
  { label: 'Agree & add', prompt: 'Help me agree with the last point and add my perspective', icon: '👍' },
  { label: 'Ask for clarity', prompt: 'Help me politely ask for clarification', icon: '🤔' },
];

// Response-based suggestions (shown after AI responds - for follow-up actions)
const RESPONSE_SUGGESTIONS: PromptSuggestion[] = [
  { label: 'Another way', prompt: 'Give me another way to say that', icon: '🔄' },
  { label: '1 vs 1', prompt: 'Make that more direct and personal, addressing one person casually (use "you", "bro", "mate" - like talking 1-on-1 instead of to a group)', icon: '👥' },
];

export function ChatPanel({ settings, onSettingsChange, sessionId, fontSize, t, externalCommand, onExternalCommandProcessed, autoSummaryForChat, onAutoSummaryProcessed }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [chatMode, setChatMode] = useState<'script' | 'info' | 'talk'>('script');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<PromptSuggestion[]>([]);
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [currentTips, setCurrentTips] = useState<string[]>([]);
  const [useExternalKnowledge, setUseExternalKnowledge] = useState(
    settings.ai?.use_external_knowledge || false
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle global key shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus input with "s" key
      if (e.key === 's' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        const isInputFocused = activeElement?.tagName === 'INPUT' ||
                               activeElement?.tagName === 'TEXTAREA' ||
                               (activeElement as HTMLElement)?.isContentEditable;

        if (!isInputFocused && inputRef.current) {
          e.preventDefault();
          inputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const apiKey = settings.ai?.api_key || '';
  const model = settings.ai?.model || 'gemini-2.5-flash';
  const translateLanguage = settings.ai?.translation_language || 'Vietnamese';
  const appLanguage = settings.language || 'en';

  // Sync useExternalKnowledge with settings when settings change
  useEffect(() => {
    setUseExternalKnowledge(settings.ai?.use_external_knowledge || false);
  }, [settings.ai?.use_external_knowledge]);

  const TOKEN_THRESHOLD = 12000;  // Snapshot at 12K tokens (~6 min conversation) - maximum speed
  const COMPACT_KEEP_RECENT = 6;  // Keep last 6 messages when compacting

  const hasLastResponse = messages.some(m => m.role === 'assistant');

  // Load session and transcript on mount
  useEffect(() => {
    loadSession();
    loadTranscript();
  }, [sessionId]);

  const loadTranscript = async () => {
    try {
      const result = await invoke<{ context: string }>('get_chat_context', {
        limit: 20,
        query: null,
        apiKey: null,
      });
      setTranscriptText(result.context || '');
    } catch {
      setTranscriptText('');
    }
  };

  // Load dynamic suggestions
  const loadDynamicSuggestions = useCallback(async () => {
    if (!apiKey || !transcriptText) return;

    setIsLoadingDynamic(true);
    try {
      const suggestions = await generateDynamicSuggestions(transcriptText, apiKey, model, appLanguage, messages);
      setDynamicSuggestions(suggestions);
    } catch (e) {
      console.error('Failed to load dynamic suggestions:', e);
    } finally {
      setIsLoadingDynamic(false);
    }
  }, [apiKey, model, transcriptText, appLanguage, messages]);

  // Auto-load dynamic suggestions when transcript changes or after some messages
  useEffect(() => {
    if (transcriptText && apiKey) {
      // Load at start, or refresh every 3 messages to get new suggestions
      if (messages.length === 0 || messages.length % 3 === 0) {
        loadDynamicSuggestions();
      }
    }
  }, [transcriptText, apiKey, messages.length, loadDynamicSuggestions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Randomize loading tips when loading starts - select 3-4 unique tips
  useEffect(() => {
    if (isLoading && t.chatTips && t.chatTips.length > 0) {
      // Shuffle array and pick 3-4 unique tips
      const shuffled = [...t.chatTips].sort(() => Math.random() - 0.5);
      const tipCount = Math.floor(Math.random() * 2) + 3; // 3 or 4 tips
      setCurrentTips(shuffled.slice(0, Math.min(tipCount, t.chatTips.length)));
    }
  }, [isLoading, t.chatTips]);

  // Handle external commands
  const pendingCommandRef = useRef<{ command: string; text: string } | null>(null);

  useEffect(() => {
    if (externalCommand && !isLoading) {
      pendingCommandRef.current = externalCommand;
      setInputText(`${externalCommand.command} '${externalCommand.text}'`);
      onExternalCommandProcessed?.();
    }
  }, [externalCommand, onExternalCommandProcessed, isLoading]);

  // Handle auto-summary message from transcript
  useEffect(() => {
    if (autoSummaryForChat) {
      // Detect if it's auto or manual summary
      const isManual = autoSummaryForChat.startsWith('[Manual]');
      const summaryType = isManual ? 'Summary' : 'Auto Summary';

      // Remove [Auto] or [Manual] prefix and markdown formatting
      const cleanContent = autoSummaryForChat
        .replace(/^\[(Auto|Manual)\]\s*/, '')  // Remove [Auto] or [Manual] prefix
        .replace(/\*\*/g, '');                   // Remove all ** markdown bold

      const summaryMessage: ChatMessage = {
        id: `summary-${Date.now()}`,
        role: 'assistant',
        content: `📋 ${summaryType}\n\n${cleanContent}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, summaryMessage]);
      onAutoSummaryProcessed?.();
    }
  }, [autoSummaryForChat, onAutoSummaryProcessed]);

  useEffect(() => {
    if (pendingCommandRef.current && inputText && !isLoading) {
      const cmd = pendingCommandRef.current;
      if (inputText.includes(cmd.text)) {
        pendingCommandRef.current = null;
        setTimeout(() => {
          const sendButton = document.querySelector('[data-send-button]') as HTMLButtonElement;
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
          }
        }, 100);
      }
    }
  }, [inputText, isLoading]);

  const loadSession = () => {
    try {
      const saved = localStorage.getItem(`chat_session_${sessionId}`);
      if (saved) {
        const session: ChatSession = JSON.parse(saved);
        setMessages(session.messages);
        setSummary(session.summary || '');
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  };

  const saveSession = (newMessages: ChatMessage[], newSummary: string) => {
    setMessages(newMessages);
    setSummary(newSummary);
    const session: ChatSession = {
      messages: newMessages,
      summary: newSummary,
      lastCompactedAt: Date.now()
    };
    localStorage.setItem(`chat_session_${sessionId}`, JSON.stringify(session));
  };

  const compactIfNeeded = async (currentMessages: ChatMessage[], currentSummary: string): Promise<{ messages: ChatMessage[], summary: string }> => {
    const totalText = currentMessages.map(m => m.content).join('') + currentSummary;
    const tokens = estimateTokens(totalText);

    if (tokens > TOKEN_THRESHOLD && currentMessages.length > COMPACT_KEEP_RECENT + 2) {
      setIsCompacting(true);
      try {
        const toCompress = currentMessages.slice(0, -COMPACT_KEEP_RECENT);
        const toKeep = currentMessages.slice(-COMPACT_KEEP_RECENT);
        const oldContext = currentSummary ? `Previous: ${currentSummary}\n` : '';
        const newSummaryText = await summarizeMessages(toCompress, apiKey, model);
        return { messages: toKeep, summary: oldContext + newSummaryText };
      } finally {
        setIsCompacting(false);
      }
    }
    return { messages: currentMessages, summary: currentSummary };
  };

  const parseCommand = (text: string): { command: ChatCommandType | undefined, args: string } => {
    // Match longer commands first to avoid partial matches (ask-about-line before ask, full-summary before summary)
    const match = text.match(/^\/(info|ask-about-line|talk-suggestions|translate|greeting|full-summary|summary|questions|answer|talk|ask)(?:\s+(.*))?$/is);
    if (match) {
      return { command: `/${match[1].toLowerCase()}` as ChatCommandType, args: match[2] || '' };
    }
    return { command: undefined, args: text };
  };

  const getContext = async (userInput?: string, intent?: ChatIntent): Promise<string> => {
    try {
      // Smart context switching - adapt window size based on query
      const limit = userInput 
        ? getAdaptiveContextLimit(userInput, intent || 'script')
        : 10;
      
      // Semantic search for INFO mode
      let searchQuery: string | null = null;
      if (intent === 'info' && userInput) {
        searchQuery = extractSearchKeywords(userInput);
      }
      
      const result = await invoke<{ context: string }>('get_chat_context', {
        limit,
        query: searchQuery,
        apiKey: searchQuery ? apiKey : null,
      });
      return result.context;
    } catch {
      return '';
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || inputText;
    if (!textToSend.trim() || isLoading) return;

    const { command, args } = parseCommand(textToSend.trim());

    // Use current chat mode as intent (no auto-detect, no prefix needed)
    const detectedIntent: ChatIntent = chatMode === 'talk' ? 'script' : chatMode;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
      command,
    };

    let newMessages = [...messages, userMessage];
    saveSession(newMessages, summary);
    setInputText('');

    if (!apiKey) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: t.pleaseConfigureApiKey || 'Please configure your Gemini API key in Settings',
        timestamp: Date.now(),
      };
      saveSession([...newMessages, errorMsg], summary);
      return;
    }

    setIsLoading(true);

    try {
      const context = await getContext(args || textToSend, detectedIntent);

      let prompt = args || textToSend;
      if (command) {
        switch (command) {
          case '/info':
            // INFO mode: factual answers about the conversation
            prompt = args || textToSend;
            break;
          case '/ask':
            prompt = `Answer this question based on my knowledge/meeting context: "${args}"`;
            break;
          case '/answer':
            prompt = `Help me respond to: "${args}". Give me the script I can say directly.`;
            break;
          case '/talk':
            prompt = `I want to discuss: "${args}". What should I say?`;
            break;
          case '/translate':
            prompt = `Translate to natural English I can say: "${args}"`;
            break;
          case '/greeting':
            prompt = 'Generate 4-5 simple ice-breaker questions or conversation starters. Topics: weekend plans, work projects, weather, travel, hobbies, family, local events. Keep it simple and warm. Can be questions or short statements. Not too casual, not too formal.\n\nFormat:\n1. [simple question or statement]\n2. [simple question or statement]\n3. [simple question or statement]\n4. [simple question or statement]\n5. [simple question or statement]\n\nStart directly with numbered list.';
            break;
          case '/summary':
            prompt = `Summarize what's happening in the current conversation/meeting. Include:
- Main topics being discussed
- Any key points, decisions, or action items (if any)
- The general context or purpose

If the transcript is short or introductory, just describe what's being talked about so far. Don't say "no key points" - summarize whatever content exists.`;
            break;
          case '/full-summary':
            // Handle full-summary separately - uses generateSummaryWithContext like auto-summary
            setIsLoading(true);
            try {
              const summaryText = await generateSummaryWithContext(apiKey, model);
              // Display as summary message with [Manual] prefix
              const summaryMessage: ChatMessage = {
                id: `summary-${Date.now()}`,
                role: 'assistant',
                content: `📋 Summary\n\n${summaryText}`,
                timestamp: Date.now(),
              };
              const newMessages = [...messages, userMessage, summaryMessage];
              saveSession(newMessages, summary);
            } catch (e) {
              console.error('Full summary error:', e);
              const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'system',
                content: `Error: ${e}`,
                timestamp: Date.now(),
              };
              saveSession([...messages, userMessage, errorMsg], summary);
            } finally {
              setIsLoading(false);
            }
            return; // Skip the normal flow since we handled it
            break;
          case '/questions':
            prompt = 'Suggest 3-5 smart questions I could ask in this meeting. Format as:\n1. [question]\n2. [question]\n3. [question]\nStart directly with the numbered list, no intro text.';
            break;
          case '/talk-suggestions':
            prompt = 'Based on the recent discussion and context, give me 3 short talking points I could say. Keep each point 1-2 sentences max. Format as:\n1. [short talking point]\n2. [short talking point]\n3. [short talking point]\nStart directly with the numbered list.';
            break;
          case '/ask-about-line':
            prompt = `Generate 5-7 questions I can ask about this statement. Include different types:
- Simple clarification questions
- Follow-up questions to understand better
- Questions to dig deeper into details
- Related questions to expand the topic

Statement: "${args}"

Format:
1. [question?]
2. [question?]
...

Generate questions I can ASK them:`;
            break;
        }
      } else if (chatMode === 'talk') {
        // In talk mode, wrap the input for translation/correction
        prompt = `Translate and correct this to natural English for speaking: "${textToSend}"`;
      }

      const session: ChatSession = { messages, summary, lastCompactedAt: Date.now() };
      const response = await callGeminiAPI(prompt, context, session, apiKey, model, chatMode, useExternalKnowledge);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      newMessages = [...newMessages, assistantMsg];
      const compacted = await compactIfNeeded(newMessages, summary);
      saveSession(compacted.messages, compacted.summary);

    } catch (e) {
      console.error('Chat error:', e);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${e}`,
        timestamp: Date.now(),
      };
      saveSession([...newMessages, errorMsg], summary);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: PromptSuggestion) => {
    handleSend(suggestion.prompt);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const clearHistory = () => {
    saveSession([], '');
  };

  // Translate a message
  const handleTranslateMessage = async (msgId: string, content: string) => {
    if (!apiKey || translatingId) return;

    setTranslatingId(msgId);
    try {
      const translated = await translateText(content, translateLanguage, apiKey, model);

      // Add translation as a new system message
      const translationMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `📝 ${translateLanguage}: ${translated}`,
        timestamp: Date.now(),
      };

      const newMessages = [...messages];
      const msgIndex = newMessages.findIndex(m => m.id === msgId);
      if (msgIndex !== -1) {
        newMessages.splice(msgIndex + 1, 0, translationMsg);
        saveSession(newMessages, summary);
      }
    } catch (e) {
      console.error('Translation failed:', e);
    } finally {
      setTranslatingId(null);
    }
  };

  // Handle model change from chat header
  const handleModelChange = (newModel: GeminiModel) => {
    onSettingsChange({
      ...settings,
      ai: {
        ...settings.ai,
        api_key: settings.ai?.api_key || '',
        model: newModel,
        translation_language: settings.ai?.translation_language,
      },
    });
  };

  // Handle external knowledge toggle change and persist
  const handleExternalKnowledgeChange = (checked: boolean) => {
    setUseExternalKnowledge(checked);
    onSettingsChange({
      ...settings,
      ai: {
        ...settings.ai,
        api_key: settings.ai?.api_key || '',
        model: settings.ai?.model || 'gemini-2.5-flash',
        translation_language: settings.ai?.translation_language,
        use_external_knowledge: checked,
      },
    });
  };

  // Get current suggestions based on state
  const currentSuggestions = hasLastResponse ? RESPONSE_SUGGESTIONS : DEFAULT_SUGGESTIONS;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#010409]">
      {/* Header with model selector */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-[#30363D]">
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => handleModelChange(e.target.value as GeminiModel)}
            className="text-xs px-2 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer bg-gray-100 text-gray-700 border-gray-300 dark:bg-[#21262D] dark:text-[#E6EDF3] dark:border-[#30363D]"
            style={{ colorScheme: settings.theme === 'light' ? 'light' : 'dark' }}
          >
            <option value="gemini-2.5-flash" className="dark:bg-[#21262D] dark:text-[#E6EDF3]">Flash 2.5</option>
            <option value="gemini-2.5-pro" className="dark:bg-[#21262D] dark:text-[#E6EDF3]">Pro 2.5</option>
            <option value="gemini-2.0-flash" className="dark:bg-[#21262D] dark:text-[#E6EDF3]">Flash 2.0</option>
          </select>
          {currentTips.length > 0 && messages.length > 0 && (
            <span className="text-xs text-amber-700 dark:text-yellow-500 italic hidden sm:inline">Tips: {currentTips.join(' • ')}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isCompacting && <span className="text-xs text-yellow-500">compacting...</span>}
          {messages.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-600">{t.clear}</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 dark:text-[#7D8590] py-4">
            <p className="text-sm font-medium">{t.meetingAssistant}</p>
            <p className="text-xs mt-1">{t.trySuggestion}</p>
          </div>
        )}

        {summary && messages.length > 0 && (
          <div className="text-xs text-center text-gray-400 py-2 border-b border-dashed border-gray-200 dark:border-[#30363D]">
            Earlier conversation summarized • {messages.length} recent
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${msg.role === 'assistant' ? 'group' : ''}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.role === 'system'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm'
                  : 'bg-gray-100 dark:bg-[#0D1117] text-gray-900 dark:text-[#E6EDF3]'
              }`}
              style={{ fontSize: `${Math.max(fontSize - 2, 12)}px` }}
            >
              {msg.command && <div className="text-xs opacity-70 mb-1 font-mono">{msg.command}</div>}
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs opacity-50">{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && !msg.content.startsWith('📝') && (
                  <button
                    onClick={() => handleTranslateMessage(msg.id, msg.content)}
                    disabled={translatingId === msg.id || !apiKey}
                    className="text-xs opacity-50 hover:opacity-100 flex items-center gap-1 disabled:opacity-30"
                    title={`${t.translateToLanguage} → ${translateLanguage}`}
                  >
                    {translatingId === msg.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Globe size={12} />
                    )}
                  </button>
                )}
              </div>
              
              {/* Quick Actions - show on hover for assistant messages */}
              {msg.role === 'assistant' && !msg.content.startsWith('📋') && !msg.content.startsWith('📝') && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-[#30363D] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleSend(`Make this shorter and more concise: "${msg.content}"`)}
                    disabled={isLoading || !apiKey}
                    className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-600 dark:text-[#7D8590] rounded hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-30"
                    title="Make shorter"
                  >
                    ✂️ Shorter
                  </button>
                  <button
                    onClick={() => handleSend(`Rewrite this in a more casual, friendly tone: "${msg.content}"`)}
                    disabled={isLoading || !apiKey}
                    className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-600 dark:text-[#7D8590] rounded hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-30"
                    title="Make casual"
                  >
                    😊 Casual
                  </button>
                  <button
                    onClick={() => handleSend(`Rewrite this in a more formal, professional tone: "${msg.content}"`)}
                    disabled={isLoading || !apiKey}
                    className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-600 dark:text-[#7D8590] rounded hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-30"
                    title="Make formal"
                  >
                    👔 Formal
                  </button>
                  <button
                    onClick={() => handleSend(`Expand on this with more details: "${msg.content}"`)}
                    disabled={isLoading || !apiKey}
                    className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-600 dark:text-[#7D8590] rounded hover:bg-slate-300 dark:hover:bg-[#30363D] disabled:opacity-30"
                    title="Add more details"
                  >
                    ➕ Details
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-[#0D1117] rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-sm text-gray-600 dark:text-[#7D8590]">{t.thinking}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Default/Response Suggestions */}
      {!isLoading && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-[#30363D]">
          <div className="flex flex-wrap gap-1.5">
            {currentSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={!apiKey}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-700 dark:text-[#E6EDF3] rounded-full hover:bg-slate-300 dark:hover:bg-[#30363D] transition-colors disabled:opacity-50"
              >
                {suggestion.icon && <span>{suggestion.icon}</span>}
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Context Suggestions */}
      {!isLoading && transcriptText && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-[#30363D] bg-slate-50/50 dark:bg-[#0D1117]">
          <div className="flex items-center gap-2 mb-1.5">
            <button
              onClick={loadDynamicSuggestions}
              disabled={isLoadingDynamic || !apiKey}
              className="text-xs text-slate-600 dark:text-[#7D8590] font-medium hover:text-slate-800 dark:hover:text-[#E6EDF3] disabled:opacity-50"
              title="Refresh suggestions"
            >
              {t.contextSuggestions}
            </button>
            <button
              onClick={loadDynamicSuggestions}
              disabled={isLoadingDynamic || !apiKey}
              className="p-0.5 text-slate-500 hover:text-slate-700 disabled:opacity-50"
              title="Refresh suggestions"
            >
              <RefreshCw size={12} className={isLoadingDynamic ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isLoadingDynamic ? (
              <span className="text-xs text-gray-400">Loading...</span>
            ) : dynamicSuggestions.length > 0 ? (
              dynamicSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={!apiKey}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-700 dark:text-[#E6EDF3] rounded-full hover:bg-slate-300 dark:hover:bg-[#30363D] transition-colors disabled:opacity-50"
                >
                  {suggestion.icon && <span>{suggestion.icon}</span>}
                  <span>{suggestion.label}</span>
                </button>
              ))
            ) : (
              // Show default context-aware suggestions when AI hasn't loaded yet
              <>
                <button onClick={() => handleSend('What should I say next?')} disabled={!apiKey} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-700 dark:text-[#E6EDF3] rounded-full hover:bg-slate-300 dark:hover:bg-[#30363D] transition-colors disabled:opacity-50">
                  <span>💬</span><span>{t.whatToSayNext}</span>
                </button>
                <button onClick={() => handleSend('Help me respond to the last point')} disabled={!apiKey} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-700 dark:text-[#E6EDF3] rounded-full hover:bg-slate-300 dark:hover:bg-[#30363D] transition-colors disabled:opacity-50">
                  <span>💡</span><span>{t.respondToLastPoint}</span>
                </button>
                <button onClick={() => handleSend('I want to add my opinion on this topic')} disabled={!apiKey} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-200 dark:bg-[#21262D] text-slate-700 dark:text-[#E6EDF3] rounded-full hover:bg-slate-300 dark:hover:bg-[#30363D] transition-colors disabled:opacity-50">
                  <span>🎯</span><span>{t.addMyOpinion}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Input with Talk Mode toggle */}
      <div className="border-t border-gray-200 dark:border-[#30363D] p-3">
        <div className="flex gap-2">
          {/* Chat Mode Toggle - 3 modes: Script, Info, Talk */}
          <button
            onClick={() => setChatMode(prev => prev === 'script' ? 'info' : prev === 'info' ? 'talk' : 'script')}
            className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 ${
              chatMode === 'script'
                ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : chatMode === 'info'
                  ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
            }`}
            title={`Mode: ${chatMode.toUpperCase()} (${t.pressTabToSwitchModes || 'Press Tab to switch'}: Script → Info → Talk)`}
          >
            {chatMode === 'script' && <MessageCircle className="w-4 h-4" />}
            {chatMode === 'info' && <Info className="w-4 h-4" />}
            {chatMode === 'talk' && <Languages className="w-4 h-4" />}
            <span className="text-xs font-medium capitalize">{chatMode}</span>
          </button>

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              } else if (e.key === 'Tab') {
                e.preventDefault();
                setChatMode(prev => prev === 'script' ? 'info' : prev === 'info' ? 'talk' : 'script');
              }
            }}
            placeholder={
              chatMode === 'script'
                ? t.askMeAnything
                : chatMode === 'info'
                  ? t.infoModePlaceholder
                  : t.talkModePlaceholder
            }
            disabled={isLoading}
            className={`flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-[#0D1117] text-gray-900 dark:text-[#E6EDF3] focus:outline-none focus:ring-2 disabled:opacity-50 text-sm ${
              chatMode === 'script'
                ? 'border-indigo-300 dark:border-indigo-700 focus:ring-indigo-500'
                : chatMode === 'info'
                  ? 'border-amber-300 dark:border-amber-700 focus:ring-amber-500'
                  : 'border-green-300 dark:border-green-700 focus:ring-green-500'
            }`}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            data-send-button
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        
        {/* External Knowledge Toggle */}
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-[#7D8590] hover:text-slate-800 dark:hover:text-[#E6EDF3]">
            <input
              type="checkbox"
              checked={useExternalKnowledge}
              onChange={(e) => handleExternalKnowledgeChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-[#30363D] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <Globe className="w-3.5 h-3.5" />
            <span>{t.allowGeneralKnowledge || 'Allow general knowledge'}</span>
          </label>
          <span 
            className="text-slate-400 dark:text-[#484F58] cursor-help" 
            title="When enabled, AI can use knowledge beyond the conversation context to provide more complete answers"
          >
            ⓘ
          </span>
        </div>

        {chatMode !== 'script' && (
          <div className={`mt-1 text-xs flex items-center gap-1 ${
            chatMode === 'info'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-green-600 dark:text-green-400'
          }`}>
            {chatMode === 'info' ? (t.infoModeHint || 'ℹ️ Info mode: Get answers about the conversation') : t.talkModeHint}
            <span className="text-slate-400 dark:text-slate-500">{t.pressTabToSwitchModes || '• Press Tab to switch modes'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
