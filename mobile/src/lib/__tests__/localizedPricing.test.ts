// M39 — localizedPricing unit tests.
//
// Locks in (1) the launch-market sv presentation, (2) the savings-percent
// derivation against the canonical sv plan, (3) Intl-style separator +
// symbol-position behaviour for non-sv locales, (4) the sv fallback
// for unknown locale tags, and (5) the `formatPaywallPrice` helper that
// reads from a RevenueCat `PurchasesPackage` and falls back when the
// SDK hasn't hydrated yet.

import type { PurchasesPackage } from 'react-native-purchases';

import {
  formatPaywallPrice,
  getLocalizedPricing,
  packagePlan,
  priceFor,
} from '../localizedPricing';

// Minimal RC package builder. Mirrors the SDK shape the paywall
// consumes — only the fields the helper reads matter.
function makePackage(args: {
  type: 'MONTHLY' | 'ANNUAL';
  priceString?: string;
  price?: number;
  introPriceString?: string | null;
}): PurchasesPackage {
  return {
    identifier: args.type === 'MONTHLY' ? '$rc_monthly' : '$rc_annual',
    packageType: args.type,
    product: {
      identifier: 'sku',
      priceString: args.priceString,
      price: args.price,
      introPrice:
        args.introPriceString === undefined
          ? null
          : args.introPriceString === null
          ? null
          : { priceString: args.introPriceString },
    },
  } as unknown as PurchasesPackage;
}

describe('localizedPricing — static ladder', () => {
  it('renders sv as the launch market with no decimals and trailing kr', () => {
    const p = getLocalizedPricing('sv');
    expect(p.monthly).toBe('119 kr');
    expect(p.yearly).toBe('899 kr');
    expect(p.currencySymbol).toBe('kr');
    expect(p.savingsPercent).toBe(37);
  });

  it('renders en with prefix dollar symbol and dot separator', () => {
    const p = getLocalizedPricing('en');
    expect(p.monthly).toBe('$7.99');
    expect(p.yearly).toBe('$69.99');
    expect(p.currencySymbol).toBe('$');
    // 1 - 69.99 / (7.99 * 12) = 0.2700... → 27%.
    expect(p.savingsPercent).toBe(27);
  });

  it('renders de with euro symbol suffixed and comma decimal separator', () => {
    const p = getLocalizedPricing('de');
    expect(p.monthly).toBe('7,99 €');
    expect(p.yearly).toBe('69,99 €');
  });

  it('falls back to sv for an unknown locale tag', () => {
    // Cast through unknown so we can exercise the `?? sv` branch without
    // narrowing the Locale type to include the synthetic tag.
    const p = getLocalizedPricing('xx-XX' as unknown as Parameters<typeof getLocalizedPricing>[0]);
    expect(p.monthly).toBe('119 kr');
    expect(p.yearly).toBe('899 kr');
  });

  it('priceFor returns the formatted plan string', () => {
    expect(priceFor('sv', 'monthly')).toBe('119 kr');
    expect(priceFor('sv', 'yearly')).toBe('899 kr');
    expect(priceFor('en', 'monthly')).toBe('$7.99');
  });

  it('computes a yearlyMonthlyEquivalent price from the yearly value', () => {
    const sv = getLocalizedPricing('sv');
    // 899 / 12 = 74.916... → rounded for display. sv has decimals: 0 so it
    // renders as a whole-kr value.
    expect(sv.yearlyMonthlyEquivalent).toBe('75 kr');

    const en = getLocalizedPricing('en');
    // 69.99 / 12 = 5.8325 → rounded to two-decimals it's 5.83.
    expect(en.yearlyMonthlyEquivalent).toBe('$5.83');
  });
});

describe('localizedPricing — formatPaywallPrice (RC path)', () => {
  it('reads priceString verbatim from a monthly package and selects the per-month period keys', () => {
    const pkg = makePackage({ type: 'MONTHLY', priceString: '119 kr', price: 119 });
    const out = formatPaywallPrice(pkg, 'sv');
    expect(out.priceString).toBe('119 kr');
    expect(out.periodKey).toBe('paywall.price.perMonth');
    expect(out.periodKeyShort).toBe('paywall.price.perMonthShort');
    // Savings only renders on the yearly plan.
    expect(out.savingsLabel).toBe(null);
  });

  it('renders the storefront priceString from RC for an annual package (US storefront example)', () => {
    const pkg = makePackage({ type: 'ANNUAL', priceString: '$69.99', price: 69.99 });
    const monthly = makePackage({ type: 'MONTHLY', priceString: '$7.99', price: 7.99 });
    const out = formatPaywallPrice(pkg, 'en', { partnerMonthlyPackage: monthly });
    expect(out.priceString).toBe('$69.99');
    expect(out.periodKey).toBe('paywall.price.perYear');
    expect(out.periodKeyShort).toBe('paywall.price.perYearShort');
    // 1 - 69.99 / (7.99 * 12) = 0.27 → 27.
    expect(out.savingsLabel).toBe('27');
  });

  it('renders the sv launch storefront price + savings against the partner monthly', () => {
    const yearly = makePackage({ type: 'ANNUAL', priceString: '899 kr', price: 899 });
    const monthly = makePackage({ type: 'MONTHLY', priceString: '119 kr', price: 119 });
    const out = formatPaywallPrice(yearly, 'sv', { partnerMonthlyPackage: monthly });
    expect(out.priceString).toBe('899 kr');
    // 1 - 899 / (119 * 12) = 0.371... → 37.
    expect(out.savingsLabel).toBe('37');
  });

  it('falls back to the static locale ladder when RC priceString is missing', () => {
    const pkg = makePackage({ type: 'MONTHLY' });
    const out = formatPaywallPrice(pkg, 'sv');
    expect(out.priceString).toBe('119 kr');
  });

  it('falls back to the static savings percent when partner monthly is missing on the yearly plan', () => {
    const yearly = makePackage({ type: 'ANNUAL', priceString: '899 kr' });
    const out = formatPaywallPrice(yearly, 'sv');
    // No partner monthly → static ladder → sv = 37%.
    expect(out.savingsLabel).toBe('37');
  });

  it('exposes the RC introPrice priceString verbatim when present', () => {
    const pkg = makePackage({
      type: 'MONTHLY',
      priceString: '119 kr',
      introPriceString: 'Free for 3 days',
    });
    const out = formatPaywallPrice(pkg, 'sv');
    expect(out.introPriceString).toBe('Free for 3 days');
  });

  it('returns null introPriceString when the package ships no intro offer', () => {
    const pkg = makePackage({ type: 'MONTHLY', priceString: '119 kr', introPriceString: null });
    const out = formatPaywallPrice(pkg, 'sv');
    expect(out.introPriceString).toBe(null);
  });

  it('classifies package plan from packageType', () => {
    expect(packagePlan(makePackage({ type: 'MONTHLY' }))).toBe('monthly');
    expect(packagePlan(makePackage({ type: 'ANNUAL' }))).toBe('yearly');
  });
});
