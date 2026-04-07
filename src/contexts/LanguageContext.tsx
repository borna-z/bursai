import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/types';
import { loadLocale } from '@/i18n/translations';
import { asPreferences } from '@/types/preferences';
import { logger } from '@/lib/logger';

const RTL_LOCALES = new Set<Locale>(['ar', 'fa']);
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';

// Re-export for consumers
export { SUPPORTED_LOCALES };
export type { Locale };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/** Cache loaded locale dictionaries so we never re-import */
const dictCache = new Map<string, Record<string, string>>();

function getInitialLocale(): Locale {
  const stored = localStorage.getItem('burs-locale') as Locale | null;
  if (stored && SUPPORTED_LOCALES.some(l => l.code === stored)) return stored;
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [enDict, setEnDict] = useState<Record<string, string>>({});
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  // Load translation dicts on mount and when locale changes
  useEffect(() => {
    let isActive = true;

    const loadDictionaries = async () => {
      const [currentDict, englishDict] = await Promise.all([
        dictCache.get(locale) ? Promise.resolve(dictCache.get(locale) as Record<string, string>) : loadLocale(locale),
        dictCache.get('en') ? Promise.resolve(dictCache.get('en') as Record<string, string>) : loadLocale('en'),
      ]);

      dictCache.set(locale, currentDict);
      dictCache.set('en', englishDict);

      if (!isActive) return;
      setDict(currentDict);
      setEnDict(englishDict);
    };

    loadDictionaries().catch(() => {
      if (!isActive) return;
      setDict({});
      setEnDict({});
    });

    return () => {
      isActive = false;
    };
  }, [locale]);

  // Sync from profile preferences on load
  useEffect(() => {
    const savedLocale = asPreferences(profile?.preferences)?.locale as Locale | undefined;
    if (savedLocale && SUPPORTED_LOCALES.some(l => l.code === savedLocale)) {
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
      const currentPrefs = asPreferences(profile.preferences);
      try {
        await updateProfile.mutateAsync({
          preferences: JSON.parse(JSON.stringify({ ...currentPrefs, locale: newLocale })),
        });
      } catch {
        // Silently fail – localStorage is the primary source
      }
    }
  }, [profile, updateProfile]);

  const t = useCallback((key: string): string => {
    const value = dict[key] ?? enDict[key];
    if (value != null) return value;
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Missing translation key: "${key}"`);
    }
    // Safety net: humanize the key instead of showing raw dotted/underscored strings
    const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
    const humanized = segment.replace(/[_-]/g, ' ');
    return humanized.charAt(0).toUpperCase() + humanized.slice(1);
  }, [dict, enDict]);

  const value = useMemo(() => ({
    locale,
    setLocale,
    t,
  }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const fallbackLocale = getInitialLocale();
    return {
      locale: fallbackLocale,
      setLocale: () => {},
      t: (key: string) => {
        const cached = dictCache.get(fallbackLocale);
        const enCached = dictCache.get('en');
        const value = cached?.[key] ?? enCached?.[key];
        if (value != null) return value;
        const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
        const humanized = segment.replace(/[_-]/g, ' ');
        return humanized.charAt(0).toUpperCase() + humanized.slice(1);
      },
    };
  }
  return ctx;
}
