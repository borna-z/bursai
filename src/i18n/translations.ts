import { type Locale } from '@/i18n/types';

// Re-export for backward compatibility
export { type Locale, SUPPORTED_LOCALES } from '@/i18n/types';
export type { LocaleMeta } from '@/i18n/types';

/**
 * Lazy-load a single locale dictionary via dynamic import.
 * Each locale lives in its own chunk so we only ship the active language.
 */
export async function loadLocale(locale: Locale): Promise<Record<string, string>> {
  const loaders: Record<Locale, () => Promise<{ default: Record<string, string> }>> = {
    sv: () => import('@/i18n/locales/sv'),
    en: () => import('@/i18n/locales/en'),
    no: () => import('@/i18n/locales/no'),
    da: () => import('@/i18n/locales/da'),
    fi: () => import('@/i18n/locales/fi'),
    de: () => import('@/i18n/locales/de'),
    fr: () => import('@/i18n/locales/fr'),
    es: () => import('@/i18n/locales/es'),
    it: () => import('@/i18n/locales/it'),
    pt: () => import('@/i18n/locales/pt'),
    nl: () => import('@/i18n/locales/nl'),
    pl: () => import('@/i18n/locales/pl'),
    ar: () => import('@/i18n/locales/ar'),
    fa: () => import('@/i18n/locales/fa'),
  };

  const loader = loaders[locale];
  if (!loader) {
    // Fallback to English if locale is unknown
    const enMod = await loaders.en();
    return enMod.default;
  }

  const mod = await loader();
  return mod.default;
}
