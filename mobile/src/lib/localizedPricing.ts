// M39 — locale-aware paywall pricing display.
//
// This module is the single composition point for the prices the
// PaywallScreen renders. Two paths:
//
//   1. RC PATH (preferred). When the RevenueCat SDK has hydrated the
//      current offering, we read `package.product.priceString` directly.
//      That string is locale + storefront-formatted by StoreKit / Play
//      Billing — Sweden returns "119 kr", US "$7.99", UK "£6.99",
//      whichever currency the user's storefront is configured for. This
//      satisfies App Review's "show the actual charge currency" rule
//      and keeps Nordics/UK/Netherlands launch markets correct without
//      hardcoding a per-locale ladder.
//
//   2. STATIC PATH (fallback). On web / simulator / before RC hydration
//      / when the API key is missing, RC returns no offerings. We show
//      the launch-market SEK display (`119 kr` / `899 kr`) so the screen
//      remains readable and the loading skeleton has something to swap
//      in if RC never resolves. The static map mirrors the canonical
//      web `src/lib/localizedPricing.ts` ladder for non-sv locales so
//      a Sentry-reported missing-key dev build at least shows familiar
//      digits.
//
// Web / mobile parity: the static entry numbers, decimals, and
// separators MUST match `src/lib/localizedPricing.ts`. The two trees
// diverge by Locale-type shape only. If pricing changes, update both
// files in lockstep.

import type { PurchasesPackage } from 'react-native-purchases';

import type { Locale } from './i18n';

export type PaywallPlan = 'monthly' | 'yearly';

export interface LocalizedPrice {
  monthly: string;
  yearly: string;
  yearlyMonthlyEquivalent: string;
  savingsPercent: number;
  currencySymbol: string;
}

/**
 * Output shape of `formatPaywallPrice`. `priceString` is the value to
 * render, `periodKey` is the i18n key for the suffix the screen pairs
 * with it, and `savingsLabel` is the (optional) yearly savings line for
 * the plan toggle's badge.
 */
export interface FormattedPaywallPrice {
  priceString: string;
  periodKey: 'paywall.price.perMonth' | 'paywall.price.perYear';
  periodKeyShort: 'paywall.price.perMonthShort' | 'paywall.price.perYearShort';
  savingsLabel: string | null;
  /** Verbatim intro-price line from RC if the package ships one. */
  introPriceString: string | null;
}

interface PriceEntry {
  monthly: number;
  yearly: number;
  symbol: string;
  prefix: boolean; // true = £4.99, false = 59 kr
  decimals: number;
  separator: string; // '.' or ','
}

// Keyed by either a mobile `Locale` value or a regional BCP-47 hint
// (`en-gb`). The lookup falls back through region → language → `sv`
// (the launch-market default).
const PRICE_MAP: Record<string, PriceEntry> = {
  sv: { monthly: 119, yearly: 899, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  // no/da/fi/nl currently fall back through i18n to en; their entries are
  // kept so a future locale expansion picks them up without re-deriving the
  // numbers (parity with web).
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
  const formatted =
    entry.decimals > 0
      ? amount.toFixed(entry.decimals).replace('.', entry.separator)
      : Math.round(amount).toString();
  return entry.prefix ? `${entry.symbol}${formatted}` : `${formatted} ${entry.symbol}`;
}

/**
 * Resolve the static price entry for a locale, with a `sv` fallback so
 * the launch market always renders correctly even if a future locale
 * lands without an entry. The fallback also covers the case where a
 * future tag like `nl` gets added to the `Locale` type before its
 * PRICE_MAP entry — better to show the SEK launch price than to crash
 * the paywall.
 */
export function getLocalizedPricing(locale: Locale): LocalizedPrice {
  const entry = PRICE_MAP[locale] ?? PRICE_MAP['sv'];
  const yearlyMonthly = entry.yearly / 12;
  // Math.round((1 - 899 / (119 * 12)) * 100) = 37 for the canonical sv plan.
  const savingsPercent = Math.round((1 - entry.yearly / (entry.monthly * 12)) * 100);

  return {
    monthly: formatAmount(entry.monthly, entry),
    yearly: formatAmount(entry.yearly, entry),
    yearlyMonthlyEquivalent: formatAmount(Math.round(yearlyMonthly * 100) / 100, entry),
    savingsPercent,
    currencySymbol: entry.symbol,
  };
}

/** Convenience accessor used by the paywall to render a single plan row. */
export function priceFor(locale: Locale, plan: PaywallPlan): string {
  const all = getLocalizedPricing(locale);
  return plan === 'monthly' ? all.monthly : all.yearly;
}

/**
 * Read a numeric `price` from a RevenueCat package, defensively. The
 * SDK's typed surface exposes `product.price` as a number on every
 * platform we ship, but older minor versions and mocked products can
 * return string-shaped numerics. Returns null if the value isn't a
 * finite number — the savings calculator falls back to the static
 * locale ladder in that case.
 */
function readPackagePrice(pkg: PurchasesPackage): number | null {
  const raw = (pkg.product as { price?: unknown }).price;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readIntroPriceString(pkg: PurchasesPackage): string | null {
  const introPrice = (pkg.product as { introPrice?: { priceString?: string } | null })
    .introPrice ?? null;
  if (!introPrice) return null;
  return typeof introPrice.priceString === 'string' ? introPrice.priceString : null;
}

/**
 * M39 — compose the paywall price-row inputs from a RevenueCat
 * `PurchasesPackage` plus the active app locale. This is the wave's
 * canonical helper.
 *
 * Output:
 *   - `priceString`     — RC's storefront-formatted price (verbatim).
 *   - `periodKey`       — i18n key for the long period suffix
 *                         ("per month" / "per year"), chosen from the
 *                         package type (MONTHLY / ANNUAL).
 *   - `periodKeyShort`  — i18n key for the short suffix used in the
 *                         plan-toggle pills ("/ month" / "/ year").
 *   - `savingsLabel`    — locale-templated "Save N%" (or null when
 *                         the percentage isn't computable). Pass the
 *                         partner monthly package to derive the % from
 *                         RC's numeric `price` fields; otherwise we
 *                         fall back to the static locale ladder.
 *   - `introPriceString`— RC's intro-offer priceString verbatim, or
 *                         null. Empty / non-string values collapse to
 *                         null so the trial line silently no-ops
 *                         instead of rendering a broken template.
 */
export function formatPaywallPrice(
  rcPackage: PurchasesPackage,
  locale: Locale,
  options?: { partnerMonthlyPackage?: PurchasesPackage | null },
): FormattedPaywallPrice {
  const product = rcPackage.product as { priceString?: string };
  const priceString =
    typeof product.priceString === 'string' && product.priceString.length > 0
      ? product.priceString
      : priceFor(locale, packagePlan(rcPackage));

  const plan = packagePlan(rcPackage);
  const periodKey =
    plan === 'monthly' ? 'paywall.price.perMonth' : 'paywall.price.perYear';
  const periodKeyShort =
    plan === 'monthly' ? 'paywall.price.perMonthShort' : 'paywall.price.perYearShort';

  // Savings percent — only meaningful for the yearly plan. Prefer the
  // numeric `price` fields (same currency on both packages, so the
  // ratio is currency-neutral). Fall back to the static locale ladder
  // when either value is missing.
  let savingsLabel: string | null = null;
  if (plan === 'yearly') {
    const yearlyPrice = readPackagePrice(rcPackage);
    const monthlyPrice = options?.partnerMonthlyPackage
      ? readPackagePrice(options.partnerMonthlyPackage)
      : null;
    let pct: number | null = null;
    if (yearlyPrice !== null && monthlyPrice !== null && monthlyPrice > 0) {
      pct = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
    } else {
      // Fall back to the static ladder so the yearly badge still has
      // a number to render on the loading / RC-unavailable path.
      pct = getLocalizedPricing(locale).savingsPercent;
    }
    if (Number.isFinite(pct) && pct > 0) {
      savingsLabel = String(pct);
    }
  }

  return {
    priceString,
    periodKey,
    periodKeyShort,
    savingsLabel,
    introPriceString: readIntroPriceString(rcPackage),
  };
}

/**
 * Map a RC `PurchasesPackage` to the paywall's monthly/yearly plan tag.
 * Defaults to monthly when the package type is unrecognised so the
 * fallback display path stays sane.
 */
export function packagePlan(pkg: PurchasesPackage): PaywallPlan {
  const t = (pkg as { packageType?: string }).packageType ?? '';
  // RevenueCat package types: MONTHLY, ANNUAL, LIFETIME, TWO_MONTH, etc.
  // We only ship MONTHLY + ANNUAL; everything else collapses to monthly
  // so an unexpected dashboard misconfiguration doesn't false-advertise
  // an annual plan.
  if (t === 'ANNUAL') return 'yearly';
  return 'monthly';
}
