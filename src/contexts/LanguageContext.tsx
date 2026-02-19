import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { translations, type Locale, SUPPORTED_LOCALES } from '@/i18n/translations';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLocale(): Locale {
  // Check localStorage first
  const stored = localStorage.getItem('drape-locale') as Locale | null;
  if (stored && translations[stored]) return stored;

  // Try browser language
  const browserLang = navigator.language.split('-')[0] as Locale;
  if (translations[browserLang]) return browserLang;

  return 'sv'; // default
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
      localStorage.setItem('drape-locale', savedLocale);
    }
  }, [profile?.preferences]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('drape-locale', newLocale);

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
    return translations[locale]?.[key] ?? translations['sv']?.[key] ?? key;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
