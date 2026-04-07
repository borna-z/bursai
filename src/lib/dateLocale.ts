import { sv, enUS, nb, da, fi, de, fr, es, it, pt, nl, pl, ar, faIR } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { Locale as AppLocale } from '@/i18n/types';

const dateFnsLocaleMap: Record<AppLocale, DateFnsLocale> = {
  sv, en: enUS, no: nb, da, fi, de, fr, es, it, pt, nl, pl, ar, fa: faIR,
};

const bcp47Map: Record<AppLocale, string> = {
  sv: 'sv-SE', en: 'en-GB', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI',
  de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT',
  nl: 'nl-NL', pl: 'pl-PL', ar: 'ar-SA', fa: 'fa-IR',
};

export function getDateFnsLocale(locale: AppLocale) {
  return dateFnsLocaleMap[locale] || sv;
}

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
