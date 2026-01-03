import { useState, ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  tabs: Tab[];
  defaultTab?: string;
}

export function TabContainer({ tabs, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex gap-1 p-1 bg-slate-200 dark:bg-[#161B22] rounded-lg mb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white'
                : 'text-slate-600 dark:text-[#E6EDF3] hover:bg-slate-300/50 dark:hover:bg-[#21262D]'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto min-h-0">{activeContent}</div>
    </div>
  );
}
