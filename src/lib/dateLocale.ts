import { enUS } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { Locale as AppLocale } from '@/i18n/types';

/** Module-level cache for loaded date-fns locale objects */
const localeCache = new Map<string, DateFnsLocale>();
localeCache.set('en', enUS);

const loaderMap: Record<AppLocale, () => Promise<{ default: DateFnsLocale } | DateFnsLocale>> = {
  en: () => Promise.resolve(enUS),
  sv: () => import('date-fns/locale/sv').then(m => m.sv ?? m.default ?? m),
  no: () => import('date-fns/locale/nb').then(m => m.nb ?? m.default ?? m),
  da: () => import('date-fns/locale/da').then(m => m.da ?? m.default ?? m),
  fi: () => import('date-fns/locale/fi').then(m => m.fi ?? m.default ?? m),
  de: () => import('date-fns/locale/de').then(m => m.de ?? m.default ?? m),
  fr: () => import('date-fns/locale/fr').then(m => m.fr ?? m.default ?? m),
  es: () => import('date-fns/locale/es').then(m => m.es ?? m.default ?? m),
  it: () => import('date-fns/locale/it').then(m => m.it ?? m.default ?? m),
  pt: () => import('date-fns/locale/pt').then(m => m.pt ?? m.default ?? m),
  nl: () => import('date-fns/locale/nl').then(m => m.nl ?? m.default ?? m),
  pl: () => import('date-fns/locale/pl').then(m => m.pl ?? m.default ?? m),
  ar: () => import('date-fns/locale/ar').then(m => m.ar ?? m.default ?? m),
  fa: () => import('date-fns/locale/fa-IR').then(m => m.faIR ?? m.default ?? m),
};

/**
 * Dynamically load and cache the date-fns locale for the given app locale.
 * Returns enUS immediately if the locale is 'en' or if loading fails.
 */
export async function loadDateFnsLocale(locale: AppLocale): Promise<DateFnsLocale> {
  const cached = localeCache.get(locale);
  if (cached) return cached;

  try {
    const loader = loaderMap[locale];
    const loaded = await loader();
    // Handle both default-export and named-export module shapes
    const result = (loaded && typeof loaded === 'object' && 'code' in loaded)
      ? loaded as DateFnsLocale
      : loaded as DateFnsLocale;
    localeCache.set(locale, result);
    return result;
  } catch {
    return enUS;
  }
}

/**
 * Synchronous getter — returns the cached locale or enUS as fallback.
 * Must be called after loadDateFnsLocale has resolved for the given locale.
 */
export function getDateFnsLocale(locale: AppLocale): DateFnsLocale {
  return localeCache.get(locale) || enUS;
}

const bcp47Map: Record<AppLocale, string> = {
  sv: 'sv-SE', en: 'en-GB', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI',
  de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT',
  nl: 'nl-NL', pl: 'pl-PL', ar: 'ar-SA', fa: 'fa-IR',
};

export function getBCP47(locale: AppLocale): string {
  return bcp47Map[locale] || 'sv-SE';
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: AppLocale, options: Intl.DateTimeFormatOptions) {
  const cacheKey = `${getBCP47(locale)}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(getBCP47(locale), options);
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatLocalizedDate(
  date: Date | string | number,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  return getFormatter(locale, options).format(normalizedDate);
}
