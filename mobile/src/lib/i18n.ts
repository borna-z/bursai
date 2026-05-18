// Minimal in-app translation dispatcher. Ships 14 locale dictionaries
// (en/sv/ar/da/de/es/fa/fi/fr/it/nl/no/pl/pt — see ../i18n/locales/*.ts),
// hand-curated for en+sv, Gemini-generated for the rest (regenerated via
// mobile/scripts/translate-locales.mjs when en.ts grows). The dispatcher
// is intentionally tiny — no async loading, no remote fetch, no react-intl
// — because the per-locale bundle (~1.7k keys × 14 locales) is well under
// any size budget and the cost of an i18n library here would dwarf the
// benefit.
//
// Conventions:
//   - keys are dot-namespaced ("auth.signIn.cta")
//   - missing keys fall back through the active locale → English → the key
//     string itself (loud-fail for misspellings)
//   - placeholders use {name} syntax: t('paywall.trial', { price: '119 SEK' })
//   - the scripts/i18n-diff.mjs CI gate fails the PR when en.ts adds a key
//     that any other locale doesn't have — prevents silent drift

import React from 'react';
import * as Localization from 'expo-localization';

import { en } from '../i18n/locales/en';
import { sv } from '../i18n/locales/sv';
import { ar } from '../i18n/locales/ar';
import { da } from '../i18n/locales/da';
import { de } from '../i18n/locales/de';
import { es } from '../i18n/locales/es';
import { fa } from '../i18n/locales/fa';
import { fi } from '../i18n/locales/fi';
import { fr } from '../i18n/locales/fr';
import { it } from '../i18n/locales/it';
import { nl } from '../i18n/locales/nl';
import { no } from '../i18n/locales/no';
import { pl } from '../i18n/locales/pl';
import { pt } from '../i18n/locales/pt';
import { log } from './log';

export type Locale =
  | 'en' | 'sv' | 'ar' | 'da' | 'de' | 'es' | 'fa' | 'fi'
  | 'fr' | 'it' | 'nl' | 'no' | 'pl' | 'pt';

const SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'sv', 'ar', 'da', 'de', 'es', 'fa', 'fi',
  'fr', 'it', 'nl', 'no', 'pl', 'pt',
];

// ISO 639 aliases — codes Expo may return that don't match SUPPORTED_LOCALES
// 1:1. Norwegian splits into Bokmål (`nb`) and Nynorsk (`nn`) on iOS/Android
// even though we ship a single combined `no` dictionary; without the alias
// step Norwegian-system users fell back to English even after the locale
// landed (Codex P2 on PR #887). Add other 1:N collapses here as they surface.
const LOCALE_ALIASES: Record<string, Locale> = {
  nb: 'no',
  nn: 'no',
};

// Pick the closest supported locale from the device's preferred-language list.
// `getLocales()` returns a ranked array — if the user's first preference is fr-CA
// we strip the region tag and match against `fr`. Falls back to en.
function detectInitialLocale(): Locale {
  try {
    const ranked = Localization.getLocales?.() ?? [];
    for (const entry of ranked) {
      const raw = (entry.languageCode ?? '').toLowerCase();
      const tag = (LOCALE_ALIASES[raw] ?? raw) as Locale;
      if (SUPPORTED_LOCALES.includes(tag)) return tag;
    }
  } catch (err) {
    log.error(err, { context: 'i18n.detect_initial_locale_failed' });
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
  en, sv, ar, da, de, es, fa, fi, fr, it, nl, no, pl, pt,
};

export function t(key: string, params?: TranslationParams): string {
  const dict = DICTIONARIES[activeLocale] ?? en;
  // Use `||` (not `??`) at every link in the chain so a `''` value in any
  // dictionary falls through to the next layer instead of rendering blank.
  // The append-only locale convention means future translators may try
  // `'foo': ''` as a way to "delete" a key; treating empty as missing keeps
  // that gesture safe at both the locale-dict and en-dict levels. The
  // final `|| key` returns the key string when nothing resolves — loud
  // failure mode for genuinely missing keys, including a deliberately-empty
  // English value.
  const raw = dict[key] || en[key] || key;
  return interpolate(raw, params);
}

// React hook so a screen re-renders when `setLocale` flips. The
// subscriber set is module-local so every mounted screen using
// `useTranslation` flips in lockstep when the active locale changes.
export function useTranslation(): { t: typeof t; locale: Locale } {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const fn = () => force();
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);
  return { t, locale: activeLocale };
}
