import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { Translations } from '../translations';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  t: Translations;
  simpleMode: boolean;
  onToggleSimpleMode: () => void;
}

export function TitleBar({ activeTab, onTabChange, t, simpleMode, onToggleSimpleMode }: Props) {
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
    <div className="h-8 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between select-none">
      {/* Left side: Logo (draggable) and Tabs */}
      <div className="flex items-center gap-2 h-full flex-1">
        {/* App name - draggable */}
        <div
          className="flex items-center h-full px-3 cursor-default"
          data-tauri-drag-region
        >
          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            {t.appName}
          </span>
        </div>

        {/* Empty draggable space */}
        <div
          className="flex-1 h-full"
          data-tauri-drag-region
        />

        {/* Tabs */}
        <div className="flex gap-0.5">
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'captions'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => onTabChange('captions')}
          >
            {t.captionsTab}
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => onTabChange('settings')}
          >
            {t.settingsTab}
          </button>
          <button
            className={`px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors duration-200 select-none ${
              activeTab === 'about'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={() => onTabChange('about')}
          >
            {t.aboutTab}
          </button>
        </div>
      </div>

      {/* Right side: Simple Mode + Window Controls */}
      <div className="flex items-center h-full">
        <button
          onClick={onToggleSimpleMode}
          className={`h-full px-3 transition-colors flex items-center justify-center gap-1 select-none ${
            simpleMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={simpleMode ? "Exit Simple Mode" : "Simple Mode - Show only live transcription"}
        >
          <Maximize2 size={14} className={simpleMode ? 'text-white' : 'text-gray-600 dark:text-gray-300'} />
          <span className={`text-xs font-medium ${simpleMode ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            Simple
          </span>
        </button>
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center select-none"
          title="Minimize"
        >
          <Minus size={14} className="text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center select-none"
          title="Maximize"
        >
          <Square size={12} className="text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-red-600 dark:hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center select-none"
          title="Close"
        >
          <X size={16} className="text-gray-600 dark:text-gray-300 hover:text-white" />
        </button>
      </div>
    </div>
  );
}
