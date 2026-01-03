import { Translations } from '../translations';
import { Mail, Heart, Github, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

interface Props {
  t: Translations;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="pt-4 mt-4 first:mt-0 first:pt-0 first:border-t-0 border-t border-gray-200 dark:border-[#30363D]">
    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-3">
      {title}
    </div>
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

const DisplayItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  description?: string;
}> = ({ icon, label, description }) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#21262D] rounded-md">
    <div className="text-indigo-600 dark:text-indigo-400">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-[#E6EDF3]">
        {label}
      </div>
      {description && (
        <div className="text-xs text-gray-600 dark:text-[#7D8590] mt-0.5">
          {description}
        </div>
      )}
    </div>
  </div>
);

const LinkItem: React.FC<{
  href: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}> = ({ href, icon, label, description }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#21262D] rounded-md hover:bg-gray-100 dark:hover:bg-[#30363D] transition-colors group"
  >
    <div className="text-indigo-600 dark:text-indigo-400">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-[#E6EDF3]">
        {label}
        <ExternalLink size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {description && (
        <div className="text-xs text-gray-600 dark:text-[#7D8590] mt-0.5">
          {description}
        </div>
      )}
    </div>
  </a>
);

export function AboutPanel({ t }: Props) {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('Unknown'));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-[#0D1117] rounded-lg text-sm">
      {/* App Info */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">
          {t.appName}
        </h1>
        {version && (
          <div className="text-xs text-gray-500 dark:text-[#7D8590] mb-2">
            Version {version}
          </div>
        )}
        <p className="text-sm text-gray-600 dark:text-[#7D8590]">
          Real-time AI-powered captions and meeting assistant
        </p>
      </div>

      {/* Contact Section */}
      <Section title={t.contact}>
        <DisplayItem
          icon={<Mail size={20} />}
          label={t.email}
          description="minhtc97@gmail.com"
        />
      </Section>

      {/* Support Section */}
      <Section title={t.support}>
        <LinkItem
          href="https://buymeacoffee.com/minhtc97e"
          icon={<Heart size={20} fill="currentColor" />}
          label={t.buyMeACoffee}
          description="Support development with a coffee"
        />
        <LinkItem
          href="https://github.com/minhtranin/zigy"
          icon={<Github size={20} />}
          label={t.githubSupport}
          description="Star the project or report issues"
        />
      </Section>
    </div>
  );
}
