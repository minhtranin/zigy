export interface Caption {
  id: string;
  text: string;
  captionType: 'partial' | 'final';
  timestamp: number;
}

export interface Settings {
  model_path: string;
  audio_source: 'mic' | 'monitor';
  font_size: number;
  theme: 'light' | 'dark';
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
