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
  theme: 'light' | 'dark';
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
