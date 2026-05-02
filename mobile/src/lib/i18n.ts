// Minimal translation shim. The web app has 14 locales via i18next; mobile
// will eventually port that or use expo-localization + i18n-js. Until then,
// this file is the single indirection point so every screen calls `t('...')`
// instead of holding hardcoded English. When i18n is wired for real, only
// the implementation of `t` and `setLocale` need to change — every call-site
// already speaks the contract.
//
// Conventions copied from the web's `t()` (see src/i18n/locales/en.ts):
//   - keys are dot-namespaced ("auth.signIn.cta")
//   - missing keys return the key itself (so a misspelled key is loud, not
//     a silent humanization fallback)
//   - placeholders use {name} syntax: t('paywall.trial', { price: '119 SEK' })

import React from 'react';

export type Locale =
  | 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';

// Currently always English — the LanguageStep stores the user's pick into
// onboarding state but doesn't yet flip the active locale. Once a real i18n
// store lands, `setLocale` will swap the active dictionary.
let activeLocale: Locale = 'en';

const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((fn) => fn());
}

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === activeLocale) return;
  activeLocale = locale;
  emit();
}

export type TranslationParams = Record<string, string | number>;

// Single string interpolation: replaces {key} with the matching param.
function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

import { en } from '../i18n/en';

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en,
  // Other locales fall back to English until their dictionaries land.
  sv: en, fr: en, de: en, es: en, it: en, ar: en, fa: en, pl: en, pt: en,
};

export function t(key: string, params?: TranslationParams): string {
  const dict = DICTIONARIES[activeLocale] ?? en;
  const raw = dict[key] ?? en[key] ?? key;
  return interpolate(raw, params);
}

// React hook so a screen re-renders when `setLocale` flips. Today this is
// purely an indirection — the dictionary is always English — but the contract
// is what callers depend on.
export function useTranslation(): { t: typeof t; locale: Locale } {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => force();
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  return { t, locale: activeLocale };
}
