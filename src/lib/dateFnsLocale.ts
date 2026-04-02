import type { Locale as DateFnsLocale } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import type { Locale as AppLocale } from '@/i18n/types';

type DateFnsLocaleModule = { default: DateFnsLocale } | DateFnsLocale;

const loaders: Record<AppLocale, () => Promise<DateFnsLocaleModule>> = {
  sv: () => import('date-fns/locale/sv'),
  en: () => import('date-fns/locale/en-US'),
  no: () => import('date-fns/locale/nb'),
  da: () => import('date-fns/locale/da'),
  fi: () => import('date-fns/locale/fi'),
  de: () => import('date-fns/locale/de'),
  fr: () => import('date-fns/locale/fr'),
  es: () => import('date-fns/locale/es'),
  it: () => import('date-fns/locale/it'),
  pt: () => import('date-fns/locale/pt'),
  nl: () => import('date-fns/locale/nl'),
  pl: () => import('date-fns/locale/pl'),
  ar: () => import('date-fns/locale/ar'),
  fa: () => import('date-fns/locale/fa-IR'),
};

const cache = new Map<AppLocale, DateFnsLocale>();

export const fallbackDateFnsLocale = enUS;

export async function loadDateFnsLocale(locale: AppLocale): Promise<DateFnsLocale> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const mod = await (loaders[locale] ?? loaders.sv)();
  const resolved = 'default' in mod ? mod.default : mod;
  cache.set(locale, resolved);
  return resolved;
}
