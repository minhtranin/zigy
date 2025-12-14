export interface Caption {
  id: string;
  text: string;
  captionType: 'partial' | 'final';
  timestamp: number;
}

// AI Settings for Gemini integration
export interface AISettings {
  api_key: string;
  model: GeminiModel;
  translation_language?: TranslationLanguage;
}

export type GeminiModel =
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-pro'
  | 'gemini-1.5-pro';

export type AppLanguage = 'en' | 'vi';

export type TranslationLanguage =
  | 'none'
  | 'zh-CN'
  | 'ja'
  | 'es'
  | 'fr'
  | 'de'
  | 'ko'
  | 'tr'
  | 'ar'
  | 'ru'
  | 'pt'
  | 'vi';

export const TRANSLATION_LANGUAGES: Record<TranslationLanguage, string> = {
  'none': 'None',
  'zh-CN': 'Chinese (Simplified)',
  'ja': 'Japanese',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ko': 'Korean',
  'tr': 'Turkish',
  'ar': 'Arabic',
  'ru': 'Russian',
  'pt': 'Portuguese',
  'vi': 'Vietnamese',
};

export interface Settings {
  model_path: string;
  audio_source: 'mic' | 'monitor';
  font_size: number;
  theme: 'light' | 'dark' | 'system';
  language: AppLanguage;
  ai?: AISettings;
}

// Summary state
export interface SummaryState {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  lastGeneratedAt: number | null;
}

// Questions state
export interface QuestionsState {
  questions: string[];
  isLoading: boolean;
  error: string | null;
  lastGeneratedAt: number | null;
}

// Knowledge base entry
export interface KnowledgeEntry {
  id: string;
  content: string;
  created_at: number;
  nominated: boolean; // Whether this entry is selected for use with Gemini
}

// Idea entry for grammar correction and script generation
export interface IdeaEntry {
  id: string;
  title: string;
  raw_content: string;        // User's raw input with mistakes
  corrected_script: string;   // Gemini corrected script
  created_at: number;         // Unix timestamp in milliseconds
}

// Timeline items for unified Ideas tab display
export type TimelineItemType = 'summary' | 'questions' | 'idea';

export interface BaseTimelineItem {
  id: string;
  timestamp: number;
  type: TimelineItemType;
}

export interface SummaryTimelineItem extends BaseTimelineItem {
  type: 'summary';
  content: string;
}

export interface QuestionsTimelineItem extends BaseTimelineItem {
  type: 'questions';
  questions: string[];
  source: 'generated' | 'ask';
  lineContext?: string;
}

export interface IdeaTimelineItem extends BaseTimelineItem {
  type: 'idea';
  title: string;
  rawContent: string;
  correctedScript: string;
}

export type TimelineItem = SummaryTimelineItem | QuestionsTimelineItem | IdeaTimelineItem;

export interface CaptionEvent {
  type: 'ready' | 'listening' | 'caption' | 'warning' | 'error' | 'stopped';
  captionType?: 'partial' | 'final';
  text?: string;
  timestamp?: number;
  message?: string;
  version?: string;
  source?: string;
}

// Gemini API response types
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

// Chat history entry - unified record of all interactions
export type ChatHistoryEntryType = 'transcript' | 'question' | 'answer' | 'summary' | 'idea' | 'translation';

export interface ChatHistoryEntry {
  id: string;
  timestamp: number;
  entry_type: ChatHistoryEntryType;
  content: string;
  metadata?: Record<string, unknown>; // For type-specific data
}

// Context compression snapshot
export interface ContextSnapshot {
  id: string;
  created_at: number;
  summary: string;           // Compressed summary of old context
  covered_until: number;     // Timestamp of last message in summary
  original_token_count: number;  // Estimated tokens before compression
  compressed_token_count: number; // Estimated tokens after compression
}

// Chat history stats from backend
export interface ChatHistoryStats {
  total_entries: number;
  total_chars: number;
  estimated_tokens: number;
  by_type: {
    transcript?: number;
    question?: number;
    answer?: number;
    summary?: number;
    idea?: number;
  };
}

// Compressed context for API calls
export interface CompressedContext {
  sessionSummary: string;      // From latest snapshot
  knowledgeBase: string;       // User's nominated knowledge
  recentHistory: string;       // Recent chat entries (full)
  estimatedTokens: number;
}
