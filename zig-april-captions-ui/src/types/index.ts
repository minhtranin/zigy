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
}

export type GeminiModel =
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-pro'
  | 'gemini-1.5-pro';

export interface Settings {
  model_path: string;
  audio_source: 'mic' | 'monitor';
  font_size: number;
  theme: 'light' | 'dark' | 'system';
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
