import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (context: string) => void;
  initialValue?: string;
}

export function InitMeetingModal({ isOpen, onClose, onSave, initialValue = '' }: Props) {
  const [context, setContext] = useState(initialValue);

  if (!isOpen) return null;

  const handleSave = () => {
    if (context.trim()) {
      onSave(context.trim());
      onClose();
    }
  };

  const handleClear = () => {
    setContext('');
    onSave('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Initialize Meeting Context
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Describe what this meeting is about. This context will be used by AI to generate better suggestions, greetings, and responses throughout the meeting.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Meeting Purpose/Agenda
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Example: I'm about to have a meeting with my operation team to discuss integrating payment API into our platform"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 dark:placeholder-gray-500"
              rows={6}
              autoFocus
            />
          </div>

          {/* Examples */}
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Examples:</p>
            <ul className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
              <li>• "Sprint planning meeting with development team for Q1 2024"</li>
              <li>• "Client presentation about new product features"</li>
              <li>• "Team retrospective to discuss project challenges"</li>
              <li>• "Budget review with finance department"</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Clear Context
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!context.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Context
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
