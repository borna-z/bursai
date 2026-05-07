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
import * as Localization from 'expo-localization';

import { en } from '../i18n/locales/en';
import { sv } from '../i18n/locales/sv';

export type Locale =
  | 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';

const SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'sv', 'fr', 'de', 'es', 'it', 'ar', 'fa', 'pl', 'pt',
];

// Pick the closest supported locale from the device's preferred-language list.
// `getLocales()` returns a ranked array — if the user's first preference is fr-CA
// we strip the region tag and match against `fr`. Falls back to en.
function detectInitialLocale(): Locale {
  try {
    const ranked = Localization.getLocales?.() ?? [];
    for (const entry of ranked) {
      const tag = (entry.languageCode ?? '').toLowerCase() as Locale;
      if (SUPPORTED_LOCALES.includes(tag)) return tag;
    }
  } catch {
    // Localization API can throw on web in obscure browsers — fall through to en.
  }
  return 'en';
}

let activeLocale: Locale = detectInitialLocale();

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

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en,
  sv,
  // Other locales fall back to English until their dictionaries land.
  // The resolver `dict[key] ?? en[key] ?? key` means partial dictionaries
  // are safe — any unset Swedish key resolves to its English value.
  fr: en, de: en, es: en, it: en, ar: en, fa: en, pl: en, pt: en,
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
