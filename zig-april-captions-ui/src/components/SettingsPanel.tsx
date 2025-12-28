import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Settings, GeminiModel, TranslationLanguage, TRANSLATION_LANGUAGES, AppLanguage } from '../types';
import { Translations } from '../translations';

interface Props {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onExport: (filePath: string) => Promise<boolean>;
  captionsCount: number;
  disabled?: boolean;
  onThemeToggle: () => void;
  effectiveTheme: 'light' | 'dark';
  t: Translations;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="pt-4 mt-4 first:mt-0 first:pt-0 first:border-t-0 border-t border-gray-200 dark:border-gray-700">
    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
      {title}
    </div>
    <div className="flex flex-col gap-4">{children}</div>
  </div>
);

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-4">
    <label className="w-28 text-sm text-gray-600 dark:text-gray-400 shrink-0">{label}</label>
    <div className="flex-1">{children}</div>
  </div>
);

export function SettingsPanel({
  settings,
  onSettingsChange,
  onExport,
  captionsCount,
  disabled,
  onThemeToggle,
  effectiveTheme,
  t,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleSelectModel = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'April Model', extensions: ['april'] }],
        title: 'Select April ASR Model',
      });
      if (selected) {
        onSettingsChange({ ...settings, model_path: selected as string });
      }
    } catch (e) {
      console.error('Failed to select model:', e);
    }
  };

  const handleExport = async () => {
    if (captionsCount === 0) return;
    setIsExporting(true);
    try {
      const filePath = await save({
        filters: [{ name: 'Text File', extensions: ['txt'] }],
        title: 'Export Captions',
        defaultPath: `captions-${new Date().toISOString().slice(0, 10)}.txt`,
      });
      if (filePath) {
        await onExport(filePath);
      }
    } catch (e) {
      console.error('Failed to export:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleApiKeyChange = (apiKey: string) => {
    onSettingsChange({
      ...settings,
      ai: {
        api_key: apiKey,
        model: settings.ai?.model || 'gemini-2.5-flash',
        translation_language: settings.ai?.translation_language,
      },
    });
  };

  const handleModelChange = (model: GeminiModel) => {
    onSettingsChange({
      ...settings,
      ai: {
        api_key: settings.ai?.api_key || '',
        model,
        translation_language: settings.ai?.translation_language,
      },
    });
  };

  const handleTranslationLanguageChange = (language: TranslationLanguage) => {
    onSettingsChange({
      ...settings,
      ai: {
        api_key: settings.ai?.api_key || '',
        model: settings.ai?.model || 'gemini-2.5-flash',
        translation_language: language,
      },
    });
  };

  const modelFileName = settings.model_path
    ? settings.model_path.split(/[\\/]/).pop()
    : 'No model selected';

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg text-sm">
      <Section title={t.speechRecognition}>
        <SettingRow label={`${t.asrModel}:`}>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelFileName}
              readOnly
              className="flex-1 w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-800 dark:text-gray-200 truncate"
              title={settings.model_path || t.noModelSelected}
            />
            <button
              onClick={handleSelectModel}
              disabled={disabled}
              className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {t.browse}
            </button>
          </div>
        </SettingRow>

        <SettingRow label={`${t.audioSource}:`}>
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm rounded-l-md border border-r-0 transition-colors ${settings.audio_source === 'mic' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'mic' })}
              disabled={disabled}
            >
              {t.microphone}
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-r-md border transition-colors ${settings.audio_source === 'monitor' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'monitor' })}
              disabled={disabled}
            >
              {t.systemAudio}
            </button>
          </div>
        </SettingRow>
      </Section>

      <Section title={t.aiSettings}>
        <SettingRow label={`${t.apiKey}:`}>
          <input
            type="password"
            value={settings.ai?.api_key || ''}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={t.apiKeyPlaceholder}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </SettingRow>

        <SettingRow label={`${t.aiModel}:`}>
          <select
            value={settings.ai?.model || 'gemini-2.5-flash'}
            onChange={(e) => handleModelChange(e.target.value as GeminiModel)}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (1st Recommended)</option>
            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Fastest, 2nd Recommended)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Quality)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Stable)</option>
          </select>
        </SettingRow>

        <SettingRow label={`${t.translation}:`}>
          <select
            value={settings.ai?.translation_language || 'none'}
            onChange={(e) => handleTranslationLanguageChange(e.target.value as TranslationLanguage)}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            {Object.entries(TRANSLATION_LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      <Section title={t.display}>
        <SettingRow label={`${t.appLanguage}:`}>
          <select
            value={settings.language}
            onChange={(e) => onSettingsChange({ ...settings, language: e.target.value as AppLanguage })}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </SettingRow>

        <SettingRow label={`${t.theme}:`}>
          <div className="flex gap-2 items-center">
            <button
              onClick={onThemeToggle}
              className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <span>{effectiveTheme === 'dark' ? '☀️' : '🌙'}</span>
              <span>{t.switchTo} {effectiveTheme === 'dark' ? t.lightMode : t.darkMode} Mode</span>
            </button>
          </div>
        </SettingRow>

        <SettingRow label={`${t.fontSize}: ${settings.font_size}px`}>
          <input
            type="range"
            min="14"
            max="48"
            value={settings.font_size}
            onChange={(e) => onSettingsChange({ ...settings, font_size: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
        </SettingRow>
      </Section>

      <Section title={t.data}>
        <SettingRow label={`${t.export}:`}>
          <button
            className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            onClick={handleExport}
            disabled={captionsCount === 0 || isExporting}
          >
            {isExporting ? t.exporting : `${t.exportCaptions} (${captionsCount} ${t.words})`}
          </button>
        </SettingRow>
      </Section>
    </div>
  );
}
