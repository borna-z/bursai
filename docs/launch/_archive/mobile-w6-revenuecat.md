# Mobile Launch — M6 — RevenueCat + paywall + webhook

**Goal:** Wire RevenueCat for mobile in-app purchases, replace 5 reactive `subscription_required` Alerts with proactive Paywall navigation, and reconcile RevenueCat purchases into the Supabase `subscriptions` table via a new `revenuecat_webhook` edge function.

**Status:** ⛔ **BLOCKED** — requires Apple Developer + RevenueCat dashboard setup before code can be tested end-to-end.
**Branch:** `mobile-w6-revenuecat-pra` then `mobile-w6-revenuecat-prb`
**PR count:** 2
**Depends on:** M0 (Sentry); benefits from M4 (Style DNA — SettingsScreen Premium caption)
**Complexity:** L

---

## What is genuinely blocked vs writable now

**Writable now (no Apple/RC dashboard needed):**
- Hook + screen scaffolding (`useSubscription`, `usePurchaseSubscription`, `useRestorePurchases`)
- Paywall screen UI
- Replacing reactive 402 Alerts with `navigation.navigate('Paywall')` calls
- The webhook edge function skeleton

**Genuinely blocked:**
- Sandbox testing (needs Apple Sandbox tester accounts)
- App Store Connect IAP product creation (`burs_premium_monthly_119sek`, `burs_premium_annual_899sek`)
- RevenueCat dashboard configuration (linking products → entitlement `premium`, webhook URL)
- StoreKit live test flow

**Decision:** ship the code work as PR A as soon as M0 is in. Sandbox verification + PR B (webhook) wait until external setup is ready. Keep PR A behind a feature flag if shipping before sandbox verification feels risky.

---

## External setup checklist (user, not Claude)

- [ ] App Store Connect — register IAP products (auto-renewable subscriptions)
- [ ] Google Play Console — matching subscription products
- [ ] RevenueCat dashboard — create app, link products, configure entitlement `premium`
- [ ] RevenueCat → webhook to `https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/revenuecat_webhook`
- [ ] Sandbox testers (3+)
- [ ] APNs auth key uploaded to RevenueCat
- [ ] `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` and `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` in EAS secrets

---

## PR A — Mobile code (writable now)

**Files:**
- `mobile/package.json` — add `react-native-purchases`
- `mobile/src/lib/revenuecat.ts` (new — init helper)
- `mobile/App.tsx` — `initRevenueCat()` after auth resolves
- `mobile/src/contexts/AuthContext.tsx` — call `Purchases.logIn(userId)` on sign-in, `Purchases.logOut()` on sign-out
- `mobile/src/hooks/useSubscription.ts` (new)
- `mobile/src/hooks/usePurchaseSubscription.ts` (new)
- `mobile/src/hooks/useRestorePurchases.ts` (new)
- `mobile/src/screens/PaywallScreen.tsx` — wire purchase + restore
- `mobile/src/screens/{StyleChat,StyleMe,MoodFlow,OutfitGenerate,WardrobeGaps}Screen.tsx` — replace `error === 'subscription_required'` Alert with `navigation.navigate('Paywall', { source: <screen-name> })`

**Skeletons:** see `docs/launch/mobile-launch-fix-plan-2026-05-31.md` § P1.5. Full implementations of all four hooks + Paywall wiring + AuthContext modifications.

## PR B — `revenuecat_webhook` edge function

**File:** `supabase/functions/revenuecat_webhook/index.ts` (new — explicit user approval to add a new edge function, per mobile/CLAUDE.md launch carve-out)

The webhook receives RevenueCat lifecycle events (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE) and upserts a `subscriptions` row for the user. RevenueCat's `app_user_id` matches Supabase `auth.users.id` — that's the identity contract.

Skeleton structure (paste full into the new file at PR B time):

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RC_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_TOKEN');

serve(async (req) => {
  // Verify RC's bearer token (RC dashboard sets this)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${RC_AUTH}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const payload = await req.json();
  const event = payload.event;
  const userId = event.app_user_id;
  // Map RC event → subscription state machine
  // upsert into subscriptions: { user_id, status, plan, current_period_end, trial_end }
  // ...
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
});
```

PR B's full skeleton lives in `mobile-launch-fix-plan-2026-05-31.md` § P1.5 PR B. Add `REVENUECAT_WEBHOOK_AUTH_TOKEN` to Supabase function env. Configure with `--no-verify-jwt` (RevenueCat doesn't send a Supabase JWT).

---

## Acceptance gates

PR A:
- TypeScript: 0 errors
- Code-reviewer: approved
- Smoke test on dev build (RC will not authenticate without keys): app launches, Paywall renders the offering placeholder, screens that hit 402 navigate to Paywall instead of Alert.

PR B:
- `deno check supabase/functions/revenuecat_webhook/index.ts` 0 errors
- Manual: deploy to staging Supabase or local-only first, send a sample RC payload via curl, verify `subscriptions` row upserted.

---

## Deploy command (post-merge of PR B)

```bash
npx supabase functions deploy revenuecat_webhook --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

---

## Tracker updates (per PR)

- PR A: M6 status → 🟡 PR A done, PR B pending. Don't advance pointer.
- PR B: M6 → DONE, advance pointer to next TODO.
- completion-log.md: 2 rows.
