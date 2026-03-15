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
