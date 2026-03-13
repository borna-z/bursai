import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { translations, type Locale, SUPPORTED_LOCALES } from '@/i18n/translations';

const RTL_LOCALES = new Set<Locale>(['ar', 'fa']);
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLocale(): Locale {
  // Admin may have a stored locale override
  const stored = localStorage.getItem('burs-locale') as Locale | null;
  if (stored && translations[stored]) return stored;

  return 'en'; // default to English
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  // Sync from profile preferences on load
  useEffect(() => {
    const savedLocale = (profile?.preferences as Record<string, unknown>)?.locale as Locale | undefined;
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale);
      localStorage.setItem('burs-locale', savedLocale);
    }
  }, [profile?.preferences]);

  // Set dir and lang on <html> whenever locale changes
  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('burs-locale', newLocale);

    // Save to profile if available
    if (profile) {
      const currentPrefs = (profile.preferences as Record<string, unknown>) || {};
      try {
        await updateProfile.mutateAsync({
          preferences: { ...currentPrefs, locale: newLocale },
        });
      } catch {
        // Silently fail – localStorage is the primary source
      }
    }
  }, [profile, updateProfile]);

  const t = useCallback((key: string): string => {
    return translations[locale]?.[key] ?? translations['en']?.[key] ?? translations['sv']?.[key] ?? key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const fallbackLocale = getInitialLocale();
    return {
      locale: fallbackLocale,
      setLocale: () => {},
      t: (key: string) =>
        translations[fallbackLocale]?.[key] ?? translations['en']?.[key] ?? translations['sv']?.[key] ?? key,
    };
  }
  return ctx;
}
