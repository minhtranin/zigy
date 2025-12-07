import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Settings } from '../types';
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

  return (
    <div className="settings-panel">
      <div className="settings-row">
        <label>Model:</label>
        <div className="settings-model">
          <input
            type="text"
            value={settings.model_path || 'No model selected'}
            readOnly
            className="model-path"
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

      <div className="settings-row">
        <button
          className="export-btn"
          onClick={handleExport}
          disabled={captionsCount === 0 || isExporting}
        >
          {isExporting ? 'Exporting...' : `Export Captions (${captionsCount})`}
        </button>
      </div>
    </div>
  );
}
