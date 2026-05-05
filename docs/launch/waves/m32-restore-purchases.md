# M32 — Restore Purchases

| Field | Value |
|---|---|
| Goal | Add the "Restore Purchases" button required by Apple guideline 3.1.1 — visible on every paywall surface. |
| Status | TODO |
| Branch | `mobile-m32-restore-purchases` |
| PR count | 1 |
| Depends on | V0, M31 |
| Complexity | S |

## Background

Required by App Store Review. RevenueCat's SDK does the work via `Purchases.restorePurchases()` — we surface the button + handle the three outcomes (premium / free / error).

## Files touched

### New
- `mobile/src/hooks/useRestorePurchases.ts` — `Purchases.restorePurchases()` → on premium-entitlement: invalidate `['subscription']` + toast success; on free: invalidate + toast info; on error: toast error.

### Modified
- `mobile/src/screens/PaywallScreen.tsx` — "Restore Purchases" link button between yearly CTA and "Not now."
- `mobile/src/screens/SettingsAccountScreen.tsx` — same button under the subscription row (Apple expects this discoverable post-paywall too).

## Pattern reference

Web `PaywallModal.tsx` `handleRestore` — same three-outcome model, RN-adapted.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual on EAS dev build with RevenueCat sandbox: sign in to a fresh device with an existing premium account, tap "Restore Purchases" → confirm app unlocks
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M32 — Restore Purchases`
