import { useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { Minus, Square, X, Maximize2, Loader2 } from 'lucide-react';
import { Translations } from '../translations';
import { useUpdateCheck } from '../hooks/useUpdateCheck';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  t: Translations;
  simpleMode: boolean;
  onToggleSimpleMode: () => void;
}

const isMac = navigator.platform.toLowerCase().includes('mac');

export function TitleBar({ activeTab, onTabChange, t, simpleMode, onToggleSimpleMode }: Props) {
  const update = useUpdateCheck();
  const [downloading, setDownloading] = useState(false);

  const handleUpdate = async () => {
    if (downloading) return;
    if (isMac && update.dmgUrl) {
      // macOS: download DMG and open it — shows drag-to-Applications window
      setDownloading(true);
      try {
        await invoke('download_and_open_update', { url: update.dmgUrl });
      } catch (e) {
        console.error('Update failed:', e);
        // fallback to releases page
        openUrl(update.releasesUrl);
      } finally {
        setDownloading(false);
      }
    } else {
      // Linux (AppImage) and Windows: open releases page
      openUrl(update.releasesUrl);
    }
  };

  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
    } catch (e) {
      console.error('Failed to minimize window:', e);
    }
  };

  const handleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      await window.toggleMaximize();
    } catch (e) {
      console.error('Failed to maximize window:', e);
    }
  };

  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (e) {
      console.error('Failed to close window:', e);
    }
  };

  return (
    <div className="h-8 bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-[#30363D] flex items-center justify-between select-none">
      {/* Left side: Logo and Tabs */}
      <div className="flex items-center gap-1 h-full">
        {/* App name - draggable */}
        <div
          className="flex items-center h-full px-3 cursor-default"
          data-tauri-drag-region
        >
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {t.appName}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'captions'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-[#E6EDF3] hover:bg-gray-100 dark:hover:bg-[#21262D]'
            }`}
            onClick={() => onTabChange('captions')}
          >
            {t.captionsTab}
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'knowledge'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-[#E6EDF3] hover:bg-gray-100 dark:hover:bg-[#21262D]'
            }`}
            onClick={() => onTabChange('knowledge')}
          >
            {t.knowledgeTab}
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-[#E6EDF3] hover:bg-gray-100 dark:hover:bg-[#21262D]'
            }`}
            onClick={() => onTabChange('settings')}
          >
            {t.settingsTab}
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'about'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-[#E6EDF3] hover:bg-gray-100 dark:hover:bg-[#21262D]'
            }`}
            onClick={() => onTabChange('about')}
          >
            {t.aboutTab}
          </button>
        </div>
      </div>

      {/* Right side: Draggable space, Simple Mode, Window Controls */}
      <div className="flex items-center h-full flex-1 justify-end">
        {/* Empty draggable space */}
        <div
          className="flex-1 h-full"
          data-tauri-drag-region
        />

        {/* Update available badge */}
        {update.available && (
          <button
            onClick={handleUpdate}
            disabled={downloading}
            className="h-full px-3 flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-70 transition-colors select-none"
            title={
              downloading
                ? 'Downloading update...'
                : `New version ${update.latestVersion} available — click to ${isMac ? 'download & install' : 'download'}`
            }
          >
            {downloading ? (
              <Loader2 size={11} className="text-white animate-spin" />
            ) : (
              <span className="text-[11px] font-semibold text-white">↑ {update.latestVersion}</span>
            )}
          </button>
        )}

        {/* Simple Mode button */}
        <button
          onClick={onToggleSimpleMode}
          className={`h-full px-3 transition-colors flex items-center justify-center select-none ${
            simpleMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'hover:bg-gray-200 dark:hover:bg-[#21262D]'
          }`}
          title={simpleMode ? "Exit Simple Mode" : "Simple Mode - Show only live transcription"}
        >
          <Maximize2 size={14} className={simpleMode ? 'text-white' : 'text-gray-600 dark:text-[#E6EDF3]'} />
        </button>

        {/* Window controls */}
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-gray-200 dark:hover:bg-[#21262D] transition-colors flex items-center justify-center select-none"
          title="Minimize"
        >
          <Minus size={14} className="text-gray-600 dark:text-[#E6EDF3]" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-gray-200 dark:hover:bg-[#21262D] transition-colors flex items-center justify-center select-none"
          title="Maximize"
        >
          <Square size={12} className="text-gray-600 dark:text-[#E6EDF3]" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center select-none"
          title="Close"
        >
          <X size={16} className="text-gray-600 dark:text-[#E6EDF3] hover:text-white" />
        </button>
      </div>
    </div>
  );
}
