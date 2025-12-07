import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Settings, GeminiModel } from '../types';
import './SettingsPanel.css';

interface Props {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onExport: (filePath: string) => Promise<boolean>;
  captionsCount: number;
  disabled?: boolean;
}

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

    try {
      setIsExporting(true);
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

  // Extract filename from path for display
  const modelFileName = settings.model_path
    ? settings.model_path.split('/').pop() || settings.model_path
    : 'No model selected';

  return (
    <div className="settings-panel">
      {/* Speech Recognition Section */}
      <div className="settings-section">
        <div className="settings-section-title">Speech Recognition</div>

        <div className="settings-row">
          <label>ASR Model:</label>
          <div className="settings-model">
            <input
              type="text"
              value={modelFileName}
              readOnly
              className="model-path"
              title={settings.model_path || 'No model selected'}
            />
            <button onClick={handleSelectModel} disabled={disabled}>
              Browse
            </button>
          </div>
        </div>

        <div className="settings-row">
          <label>Audio Source:</label>
          <div className="settings-toggle">
            <button
              className={settings.audio_source === 'mic' ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'mic' })}
              disabled={disabled}
            >
              Microphone
            </button>
            <button
              className={settings.audio_source === 'monitor' ? 'active' : ''}
              onClick={() => onSettingsChange({ ...settings, audio_source: 'monitor' })}
              disabled={disabled}
            >
              System Audio
            </button>
          </div>
        </div>
      </div>

      {/* AI Settings Section */}
      <div className="settings-section">
        <div className="settings-section-title">AI Settings (Gemini)</div>

        <div className="settings-row">
          <label>API Key:</label>
          <div className="settings-api-key">
            <input
              type="password"
              value={settings.ai?.api_key || ''}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Enter Gemini API key"
              className="api-key-input"
            />
          </div>
        </div>

        <div className="settings-row">
          <label>AI Model:</label>
          <select
            value={settings.ai?.model || 'gemini-2.5-flash'}
            onChange={(e) => handleModelChange(e.target.value as GeminiModel)}
            className="model-select"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Quality)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Stable)</option>
          </select>
        </div>
      </div>

      {/* Display Section */}
      <div className="settings-section">
        <div className="settings-section-title">Display</div>

        <div className="settings-row">
          <label>Font Size: {settings.font_size}px</label>
          <input
            type="range"
            min="14"
            max="48"
            value={settings.font_size}
            onChange={(e) =>
              onSettingsChange({ ...settings, font_size: parseInt(e.target.value) })
            }
          />
        </div>
      </div>

      {/* Data Section */}
      <div className="settings-section">
        <div className="settings-section-title">Data</div>

        <div className="settings-row">
          <button
            className="export-btn"
            onClick={handleExport}
            disabled={captionsCount === 0 || isExporting}
          >
            {isExporting ? 'Exporting...' : `Export Captions (${captionsCount} words)`}
          </button>
        </div>
      </div>
    </div>
  );
}
