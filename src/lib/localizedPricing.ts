// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: SEK-denominated Stripe Price ID display strings; mobile uses RC product catalog.
import type { Locale } from '@/i18n/types';

export interface LocalizedPrice {
  monthly: string;
  yearly: string;
  yearlyMonthlyEquivalent: string;
  savingsPercent: number;
  currencySymbol: string;
}

interface PriceEntry {
  monthly: number;
  yearly: number;
  symbol: string;
  prefix: boolean; // true = £4.99, false = 59 kr
  decimals: number;
  separator: string; // '.' or ','
}

// Wave 8 P56 — Sweden is the launch market and the canonical pricing
// reference for the entire SaaS plan: **119 SEK/month, 899 SEK/year**.
// `STRIPE_PRICE_ID_MONTHLY_TEST/_LIVE` + `STRIPE_PRICE_ID_YEARLY_TEST/_LIVE`
// (see .env.example) point at SEK-denominated Stripe Prices, so every user
// regardless of locale is charged in SEK at checkout. The display strings
// here are the locale-localized PRESENTATION of that single SEK price —
// `sv` is the source of truth (matches the SEK ledger amount exactly).
//
// `no` and `da` retain their existing local-currency display for now;
// rationale: NOK and DKK are different currencies despite sharing the
// "kr" symbol, and aligning them visually to 119/899 would imply local-
// currency billing that the Stripe config doesn't actually do. Tracked
// for future review (see Findings Log entry for P56 — Wave 8.5 owns).
const PRICE_MAP: Record<string, PriceEntry> = {
  sv: { monthly: 119, yearly: 899, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  no: { monthly: 79, yearly: 699, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  da: { monthly: 59, yearly: 499, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  fi: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  de: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  fr: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  es: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  it: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  pt: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  nl: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  fa: { monthly: 7.99, yearly: 69.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  en: { monthly: 7.99, yearly: 69.99, symbol: '$', prefix: true, decimals: 2, separator: '.' },
  'en-gb': { monthly: 7.99, yearly: 69.99, symbol: '£', prefix: true, decimals: 2, separator: '.' },
  pl: { monthly: 29.99, yearly: 249, symbol: 'zł', prefix: false, decimals: 0, separator: ',' },
  ar: { monthly: 25, yearly: 219, symbol: 'د.إ', prefix: false, decimals: 0, separator: '.' },
};

function formatAmount(amount: number, entry: PriceEntry): string {
  const formatted = entry.decimals > 0
    ? amount.toFixed(entry.decimals).replace('.', entry.separator)
    : Math.round(amount).toString();
  return entry.prefix ? `${entry.symbol}${formatted}` : `${formatted} ${entry.symbol}`;
}

export function getLocalizedPricing(locale: Locale): LocalizedPrice {
  const entry = PRICE_MAP[locale] || PRICE_MAP['sv'];
  const yearlyMonthly = entry.yearly / 12;
  const savingsPercent = Math.round((1 - entry.yearly / (entry.monthly * 12)) * 100);

  return {
    monthly: formatAmount(entry.monthly, entry),
    yearly: formatAmount(entry.yearly, entry),
    yearlyMonthlyEquivalent: formatAmount(Math.round(yearlyMonthly * 100) / 100, entry),
    savingsPercent,
    currencySymbol: entry.symbol,
  };
}
