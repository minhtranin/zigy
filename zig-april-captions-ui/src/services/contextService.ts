import { invoke } from '@tauri-apps/api/core';
import {
  ChatHistoryEntry,
  ContextSnapshot,
  ChatHistoryStats,
  CompressedContext,
  KnowledgeEntry,
  GeminiModel,
  GeminiResponse,
} from '../types';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Token estimation: ~4 characters per token for Gemini
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokensForEntries(entries: ChatHistoryEntry[]): number {
  const totalChars = entries.reduce((sum, entry) => sum + entry.content.length, 0);
  return estimateTokens(totalChars.toString());
}

// Configuration
const DEFAULT_TOKEN_LIMIT = 18000; // Leave room for prompt + response (optimized for 1-2s response time)
const DEFAULT_RECENT_MESSAGE_COUNT = 35; // Keep last N messages full
const COMPRESSION_THRESHOLD = 60; // Start compressing after this many messages

// Generate context summary using Gemini (meta-summarization)
const CONTEXT_COMPRESSION_PROMPT = `You are a context compression assistant. Summarize the following chat history into a concise summary that preserves key information for future AI responses.

Focus on:
- Main topics discussed in the conversation
- Key facts and information mentioned
- Important user preferences or context
- Any ongoing threads or unresolved questions
- Names, dates, and specific details that might be referenced later

Keep the summary factual and information-dense. Do not include filler words or pleasantries.
Maximum length: 500 words.

Chat history to compress:`;

async function generateContextSummary(
  oldContext: string,
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<string> {
  if (!apiKey || !oldContext.trim()) {
    return '';
  }

  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${CONTEXT_COMPRESSION_PROMPT}\n\n${oldContext}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      topP: 0.8,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('Failed to generate context summary');
      return '';
    }

    const data: GeminiResponse = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error generating context summary:', error);
    return '';
  }
}

// Build compressed context for API calls
export async function buildCompressedContext(
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash',
  targetTokenLimit: number = DEFAULT_TOKEN_LIMIT,
  recentMessageCount: number = DEFAULT_RECENT_MESSAGE_COUNT
): Promise<CompressedContext> {
  // Load chat history from backend
  const allEntries = await invoke<ChatHistoryEntry[]>('get_chat_history', {
    since: null,
    limit: null
  });

  // Load knowledge base
  const knowledgeEntries = await invoke<KnowledgeEntry[]>('get_knowledge');
  const nominatedKnowledge = knowledgeEntries.filter(e => e.nominated);
  const knowledgeBase = nominatedKnowledge.map(e => e.content).join('\n\n');
  const knowledgeTokens = estimateTokens(knowledgeBase);

  // Adjust available tokens for context
  const availableForHistory = targetTokenLimit - knowledgeTokens - 500; // Reserve 500 for prompt overhead

  // Check for saved snapshot (preserves context across clears)
  const latestSnapshot = await invoke<ContextSnapshot | null>('get_latest_snapshot');

  if (allEntries.length === 0) {
    // No current history - use saved snapshot if available
    if (latestSnapshot) {
      return {
        sessionSummary: latestSnapshot.summary,
        knowledgeBase,
        recentHistory: '',
        estimatedTokens: knowledgeTokens + latestSnapshot.compressed_token_count,
      };
    }
    return {
      sessionSummary: '',
      knowledgeBase,
      recentHistory: '',
      estimatedTokens: knowledgeTokens,
    };
  }

  // If we have few entries, combine with snapshot if available
  if (allEntries.length <= recentMessageCount) {
    const recentHistory = allEntries
      .map(e => `[${e.entry_type}] ${e.content}`)
      .join('\n');
    const historyTokens = estimateTokens(recentHistory);

    return {
      sessionSummary: latestSnapshot?.summary || '',
      knowledgeBase,
      recentHistory,
      estimatedTokens: knowledgeTokens + historyTokens + (latestSnapshot?.compressed_token_count || 0),
    };
  }

  // Split into recent and old entries
  const recentEntries = allEntries.slice(-recentMessageCount);
  const oldEntries = allEntries.slice(0, -recentMessageCount);

  const recentHistory = recentEntries
    .map(e => `[${e.entry_type}] ${e.content}`)
    .join('\n');
  const recentTokens = estimateTokens(recentHistory);
  const oldTokens = estimateTokensForEntries(oldEntries);

  // If everything fits, return without compression
  if (recentTokens + oldTokens <= availableForHistory) {
    const fullHistory = allEntries
      .map(e => `[${e.entry_type}] ${e.content}`)
      .join('\n');

    return {
      sessionSummary: '',
      knowledgeBase,
      recentHistory: fullHistory,
      estimatedTokens: knowledgeTokens + recentTokens + oldTokens,
    };
  }

  // Need compression - check if we have a valid snapshot
  const oldestOldEntry = oldEntries[0];

  if (latestSnapshot && oldestOldEntry && latestSnapshot.covered_until >= oldestOldEntry.timestamp) {
    // Use existing snapshot
    return {
      sessionSummary: latestSnapshot.summary,
      knowledgeBase,
      recentHistory,
      estimatedTokens: knowledgeTokens + latestSnapshot.compressed_token_count + recentTokens,
    };
  }

  // Generate new summary if we have API key and enough entries to justify it
  if (apiKey && oldEntries.length >= COMPRESSION_THRESHOLD) {
    const oldContent = oldEntries
      .map(e => `[${e.entry_type}] ${e.content}`)
      .join('\n');

    const summary = await generateContextSummary(oldContent, apiKey, model);

    if (summary) {
      // Save the snapshot
      const snapshot: ContextSnapshot = {
        id: `snapshot-${Date.now()}`,
        created_at: Date.now(),
        summary,
        covered_until: oldEntries[oldEntries.length - 1]?.timestamp || Date.now(),
        original_token_count: oldTokens,
        compressed_token_count: estimateTokens(summary),
      };

      await invoke('save_context_snapshot', { snapshot });

      return {
        sessionSummary: summary,
        knowledgeBase,
        recentHistory,
        estimatedTokens: knowledgeTokens + estimateTokens(summary) + recentTokens,
      };
    }
  }

  // Fallback: return recent entries only (no compression available)
  return {
    sessionSummary: '',
    knowledgeBase,
    recentHistory,
    estimatedTokens: knowledgeTokens + recentTokens,
  };
}

// Add a chat entry to history
export async function addChatEntry(
  entryType: ChatHistoryEntry['entry_type'],
  content: string,
  metadata?: Record<string, unknown>
): Promise<ChatHistoryEntry> {
  const entry: ChatHistoryEntry = {
    id: `${entryType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    entry_type: entryType,
    content,
    metadata,
  };

  return await invoke<ChatHistoryEntry>('add_chat_entry', { entry });
}

// Get chat history stats
export async function getChatHistoryStats(): Promise<ChatHistoryStats> {
  return await invoke<ChatHistoryStats>('get_chat_history_stats');
}

// Clear all chat history and snapshots
export async function clearAllContext(): Promise<void> {
  await invoke('clear_chat_history');
  await invoke('clear_context_snapshots');
}

// Create a session snapshot before clearing (for session boundaries)
export async function createSessionSnapshot(
  apiKey: string,
  model: GeminiModel = 'gemini-2.5-flash'
): Promise<ContextSnapshot | null> {
  if (!apiKey) {
    return null;
  }

  const allEntries = await invoke<ChatHistoryEntry[]>('get_chat_history', {
    since: null,
    limit: null
  });

  if (allEntries.length < 10) {
    // Not enough content to create a meaningful snapshot
    return null;
  }

  const content = allEntries
    .map(e => `[${e.entry_type}] ${e.content}`)
    .join('\n');

  const summary = await generateContextSummary(content, apiKey, model);

  if (!summary) {
    return null;
  }

  const snapshot: ContextSnapshot = {
    id: `session-${Date.now()}`,
    created_at: Date.now(),
    summary,
    covered_until: allEntries[allEntries.length - 1]?.timestamp || Date.now(),
    original_token_count: estimateTokens(content),
    compressed_token_count: estimateTokens(summary),
  };

  await invoke('save_context_snapshot', { snapshot });
  return snapshot;
}

// Build context string for Gemini API calls
export function buildContextString(context: CompressedContext, includeKnowledge: boolean = true): string {
  let contextStr = '';

  if (context.sessionSummary) {
    contextStr += `Previous Session Context:\n${context.sessionSummary}\n\n`;
  }

  if (includeKnowledge && context.knowledgeBase) {
    contextStr += `User Knowledge Base:\n${context.knowledgeBase}\n\n`;
  }

  if (context.recentHistory) {
    contextStr += `Recent Conversation:\n${context.recentHistory}`;
  }

  return contextStr;
}

// Get compression ratio for display
export function getCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 1;
  return compressed / original;
}

// Check if compression is needed
export async function shouldCompress(): Promise<boolean> {
  const stats = await getChatHistoryStats();
  return stats.total_entries > COMPRESSION_THRESHOLD;
}
