# M31 — RevenueCat + paywall + webhook

| Field | Value |
|---|---|
| Goal | Wire `react-native-purchases` (RevenueCat SDK), the Paywall screen, and a new `revenuecat_webhook` edge function that mirrors Stripe webhook semantics. |
| Status | DONE (PR A: #758, PR B: #TBD) |
| Branch | `mobile-m31-revenuecat` |
| PR count | 2 (PR A: client + paywall; PR B: webhook edge function) |
| Depends on | V0 |
| Complexity | L |

## Background

iOS billing is StoreKit-only — Stripe cannot be used for digital goods on iOS. RevenueCat owns receipt validation; our webhook syncs entitlements to the `subscriptions` table so existing `enforceSubscription` works unchanged.

This wave covers code only. The dashboard configuration, IAP product creation, and sandbox verification ship in M44 (external setup).

## Files touched

### PR A — client + paywall
#### New
- `mobile/src/hooks/useSubscription.ts` — reads `subscriptions` table state; same `'trialing' | 'premium' | 'locked'` machine as web.
- `mobile/src/hooks/usePurchaseSubscription.ts` — `Purchases.purchasePackage` → on success, polls `subscriptions` until row reflects entitlement (webhook-driven).
- `mobile/src/lib/revenuecat.ts` — `Purchases.configure({ apiKey, appUserID: user.id })` on auth.

#### Modified
- `mobile/src/screens/PaywallScreen.tsx` — wire CTA buttons to `usePurchaseSubscription`; show plan rows (monthly + yearly).
- `mobile/App.tsx` — call `revenuecat.ts` configure after auth.

### PR B — webhook edge function
#### New
- `supabase/functions/revenuecat_webhook/index.ts` — verifies `X-RevenueCat-Signature` header (HMAC SHA256 over body); upserts `subscriptions` row matching `app_user_id` to user_id; logs to `revenuecat_events` table for idempotency.
- Migration: `<ts>_revenuecat_events.sql` — idempotency log table mirroring `stripe_events`.

## Pattern reference

Web `useSubscription` for the state machine. Webhook signature verification: Deno's standard `crypto.subtle.importKey + verify` flow.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual on EAS dev build with RevenueCat sandbox key: trigger a purchase → confirm webhook fires → confirm `subscriptions` row updates → confirm app unlocks within ~10s
- Code-reviewer: approved

## Deploy

```bash
npx supabase db push --linked --yes
npx supabase functions deploy revenuecat_webhook --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

## PR template

PR A title: `feat(mobile): M31 PR A — RevenueCat client + paywall wiring`
PR B title: `feat(mobile): M31 PR B — revenuecat_webhook edge function`
