import { defaultLang, type Language } from './languages';
import en from './translations/en';
import vi from './translations/vi';

const translations = {
  en,
  vi,
} as const;

export function getLangFromUrl(url: URL): Language {
  // Remove base path if present (e.g., /zigy/vi/ -> /vi/)
  const pathname = url.pathname.replace('/zigy', '');
  const [, lang] = pathname.split('/');
  if (lang === 'vi') return 'vi';
  return defaultLang;
}

export function useTranslations(lang: Language) {
  return function t(key: keyof typeof en, vars?: Record<string, string>): string {
    let text = translations[lang][key] || translations[defaultLang][key] || key;

    // Replace variables like {year}
    if (vars) {
      Object.entries(vars).forEach(([varKey, varValue]) => {
        text = text.replace(`{${varKey}}`, varValue);
      });
    }

    return text;
  };
}

export function getPathWithLang(path: string, lang: Language): string {
  if (lang === defaultLang) {
    return path;
  }
  return `/${lang}${path}`;
}
