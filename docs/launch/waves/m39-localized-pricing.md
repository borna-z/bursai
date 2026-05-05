# M39 — Localized pricing

| Field | Value |
|---|---|
| Goal | Port `localizedPricing.ts` so PaywallScreen displays prices in the user's locale (currency + formatting), even though RevenueCat charges in the configured store currency. |
| Status | TODO |
| Branch | `mobile-m39-localized-pricing` |
| PR count | 1 |
| Depends on | V0, M33 |
| Complexity | S |

## Background

Web `localizedPricing.ts` maps locales → display currencies + format functions. Sweden launches at 119 SEK / 899 SEK. Mobile currently hardcodes the SEK display. Localized pricing on mobile is presentation-only — RevenueCat handles the actual billing currency per App Store Connect / Play Console product config.

## Files touched

### New
- `mobile/src/lib/localizedPricing.ts` — port from web. `priceFor(locale, plan)` returns `{ amount, currency, formatted }`.

### Modified
- `mobile/src/screens/PaywallScreen.tsx` — replace hardcoded "119 SEK" with `priceFor(locale, 'monthly').formatted`.
- `mobile/src/lib/i18n.ts` — append `paywall.price.*` keys (currency suffix per locale).

## Pattern reference

Web `localizedPricing.ts` lifts. NOK/DKK display values match web's existing config (kept distinct from SEK despite shared `kr` symbol — see PR #705 commentary).

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: switch device locale through sv / no / da / en-US → confirm price line displays correctly each time
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M39 — localized pricing`
