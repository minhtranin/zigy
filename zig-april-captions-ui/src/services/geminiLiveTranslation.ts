import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TranslationLanguage } from '../types';

let unlistenResult: (() => void) | null = null;
let unlistenStatus: (() => void) | null = null;

export function startLiveTranslation(
  apiKey: string,
  language: TranslationLanguage,
  meetingContext: string | undefined,
  onTranslation: (originalText: string, translatedText: string) => void,
  onStatusChange: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void,
): void {
  stopLiveTranslation();

  onStatusChange('connecting');

  listen<{ originalText: string; translatedText: string }>('translation-result', (event) => {
    onTranslation(event.payload.originalText, event.payload.translatedText);
  }).then((unlisten) => {
    unlistenResult = unlisten;
  });

  listen<string>('translation-status', (event) => {
    onStatusChange(event.payload as 'disconnected' | 'connecting' | 'connected' | 'error');
  }).then((unlisten) => {
    unlistenStatus = unlisten;
  });

  invoke('translate_start', {
    apiKey,
    language,
    meetingContext: meetingContext || null,
  }).catch((e) => {
    console.error('[Translation] Failed to start:', e);
    onStatusChange('error');
  });
}

export function translateText(text: string): void {
  if (!text || text.trim().length < 2) return;
  invoke('translate_text', { text: text.trim() }).catch((e) => {
    console.error('[Translation] Failed to send text:', e);
  });
}

export function stopLiveTranslation(): void {
  if (unlistenResult) {
    unlistenResult();
    unlistenResult = null;
  }
  if (unlistenStatus) {
    unlistenStatus();
    unlistenStatus = null;
  }
  invoke('translate_stop').catch(() => {});
}
