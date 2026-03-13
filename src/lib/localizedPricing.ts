import type { Locale } from '@/i18n/translations';

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

const PRICE_MAP: Record<string, PriceEntry> = {
  sv: { monthly: 79, yearly: 699, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  no: { monthly: 79, yearly: 699, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  da: { monthly: 39, yearly: 329, symbol: 'kr', prefix: false, decimals: 0, separator: ',' },
  fi: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  de: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  fr: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  es: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  it: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  pt: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  nl: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  fa: { monthly: 4.99, yearly: 44.99, symbol: '€', prefix: false, decimals: 2, separator: ',' },
  en: { monthly: 3.99, yearly: 34.99, symbol: '£', prefix: true, decimals: 2, separator: '.' },
  pl: { monthly: 19.99, yearly: 179, symbol: 'zł', prefix: false, decimals: 0, separator: ',' },
  ar: { monthly: 19, yearly: 169, symbol: 'د.إ', prefix: false, decimals: 0, separator: '.' },
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
