// Locale-aware price formatting for shopping cards.
//
// Replaces the M23 `{amount} {currency}` template (which produced "199 SEK"
// for every locale regardless of separator/symbol-position conventions). For
// a Swedish user we want "199 kr"; for en-US "$11.99"; for de-DE "11,99 $".
// `Intl.NumberFormat` ships with Hermes (RN's JS engine) under SDK 51+ and
// resolves the right glyph + position automatically.
//
// The fallback path covers two real failure modes:
//   1. Older Hermes builds on Android lack ICU data for some locale tags
//      (`Intl.NumberFormat('fa-IR', ...).format` throws RangeError).
//   2. A malformed currency code from the AI envelope (the contract says
//      ISO-4217 but the model can hallucinate) raises RangeError too.
// In both cases we degrade to the legacy "{amount} {currency}" rendering
// rather than dropping the price entirely — a slightly-ugly price still
// helps the user evaluate the suggestion.

import type { Locale } from './i18n';

// Intl uses BCP-47 language tags. Map our ISO-639 codes to the closest
// matching tag with a region hint where the region influences formatting
// (currency symbol position, decimal separator, grouping). The region tags
// here are Sweden-launch markets + the largest English-speaking market for
// `en`. Other locales fall through to the bare language tag, which lets
// Intl pick its own default region.
const LOCALE_TO_BCP47: Partial<Record<Locale, string>> = {
  sv: 'sv-SE',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  pl: 'pl-PL',
  // Pin region tags for ar/fa so Intl uses a stable digit-shaping +
  // grouping convention across iOS/Android Hermes builds (bare `ar`/`fa`
  // resolves to platform-default region, which differs).
  ar: 'ar-SA',
  fa: 'fa-IR',
};

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  const tag = LOCALE_TO_BCP47[locale] ?? locale;
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency,
      // Cards typically carry whole-currency prices (199 kr, $25). Suppress
      // the trailing `,00` for whole values by setting `min=0`, while still
      // allowing two fraction digits for currencies/values that need them
      // (USD $11.99). Without `minimumFractionDigits: 0`, Intl inherits the
      // currency's standard (SEK = 2), so 199 SEK would render as "199,00 kr"
      // when the audit acceptance asks for "199 kr".
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Hermes-without-ICU or a bad currency code — fall back to the legacy
    // template so the card still renders something parseable.
    return `${amount} ${currency}`;
  }
}
