import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Settings, GeminiModel } from '../types';

interface Props {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onExport: (filePath: string) => Promise<boolean>;
  captionsCount: number;
  disabled?: boolean;
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
      },
    });
  };

  const handleModelChange = (model: GeminiModel) => {
    onSettingsChange({
      ...settings,
      ai: {
        api_key: settings.ai?.api_key || '',
        model,
      },
    });
  };

  const modelFileName = settings.model_path
    ? settings.model_path.split(/[\\/]/).pop()
    : 'No model selected';

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg text-sm">
      <Section title="Speech Recognition">
        <SettingRow label="ASR Model:">
          <div className="flex gap-2">
            <input
              type="text"
              value={modelFileName}
              readOnly
              className="flex-1 w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-gray-800 dark:text-gray-200 truncate"
              title={settings.model_path || 'No model selected'}
            />
            <button 
              onClick={handleSelectModel} 
              disabled={disabled}
              className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Browse
            </button>
          </div>
        </SettingRow>

        <SettingRow label="Audio Source:">
          <div className="flex">
            <button
              className={`px-4 py-2 text-sm rounded-l-md border border-r-0 transition-colors ${settings.audio_source === 'mic' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'mic' })}
              disabled={disabled}
            >
              Microphone
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-r-md border transition-colors ${settings.audio_source === 'monitor' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'monitor' })}
              disabled={disabled}
            >
              System Audio
            </button>
          </div>
        </SettingRow>
      </Section>

      <Section title="AI Settings (Gemini)">
        <SettingRow label="API Key:">
          <input
            type="password"
            value={settings.ai?.api_key || ''}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder="Enter Gemini API key"
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </SettingRow>

        <SettingRow label="AI Model:">
          <select
            value={settings.ai?.model || 'gemini-2.5-flash'}
            onChange={(e) => handleModelChange(e.target.value as GeminiModel)}
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Quality)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Stable)</option>
          </select>
        </SettingRow>
      </Section>

      <Section title="Display">
        <SettingRow label={`Font Size: ${settings.font_size}px`}>
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

      <Section title="Data">
        <SettingRow label="Export:">
          <button
            className="px-4 py-2 text-sm font-semibold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            onClick={handleExport}
            disabled={captionsCount === 0 || isExporting}
          >
            {isExporting ? 'Exporting...' : `Export Captions (${captionsCount} words)`}
          </button>
        </SettingRow>
      </Section>
    </div>
  );
}
