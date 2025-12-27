export const languages = {
  en: 'English',
  vi: 'Tiếng Việt',
} as const;

export type Language = keyof typeof languages;

export const defaultLang: Language = 'en';
