## Wave 8 — Subscription Model Enforcement

### P52 — Auto-start trial on signup

**Problem**
Currently signup doesn't auto-create a Stripe customer or trial subscription. User can use the app as "free tier" indefinitely.

**Fix**
New edge function `start_trial` (or extend `create_checkout_session`):
1. Called on signup completion (from Auth.tsx after successful sign-up)
2. Creates Stripe customer with metadata.supabase_user_id
3. Creates Stripe subscription in trial mode with 3-day trial_end
4. Updates `profiles.stripe_customer_id` and inserts `subscriptions` row with `status='trialing'`, `plan='premium'`
5. Sets `profiles.onboarding_started_at = NOW()`

```typescript
// supabase/functions/start_trial/index.ts
serve(async (req) => {
  const { user_id } = await req.json();
  // auth check: caller's JWT user.id === user_id
  const stripe = new Stripe(...);
  const customer = await stripe.customers.create({ metadata: { supabase_user_id: user_id } });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceIdMonthly }],
    trial_period_days: 3,
    payment_behavior: 'default_incomplete',
  });
  // Store state...
});
```

In `src/pages/Auth.tsx` signup flow, call this after successful signup.

**Files**
- `supabase/functions/start_trial/index.ts` (new)
- `src/pages/Auth.tsx`

**Acceptance**
- New signup has Stripe customer + trialing subscription + onboarding_started_at set
- 3-day trial end date correct
- Idempotent — re-signup doesn't create duplicate customers

**Deploy** `start_trial` (new function)

---

### P53 — Remove free tier

**Problem**
Currently `useSubscription` has a 'free' state path. Per spec: no free tier, only trial/premium/locked.

**Fix**
Refactor `src/hooks/useSubscription.ts`:
```typescript
type SubscriptionState = 'trialing' | 'premium' | 'locked';

export function useSubscription() {
  // ... existing query
  const state: SubscriptionState = useMemo(() => {
    if (!subscription) return 'locked';
    if (subscription.status === 'trialing') return 'trialing';
    if (subscription.status === 'active' && subscription.plan === 'premium') return 'premium';
    return 'locked';
  }, [subscription]);

  return { state, isPremium: state !== 'locked', ... };
}
```

Update all consumers:
- `PaywallModal` — show for `locked` state
- `PLAN_LIMITS` — only `premium` values, no `free`

**Files**
- `src/hooks/useSubscription.ts`
- Every consumer of `useSubscription` (grep `useSubscription`)

**Acceptance**
- No `free` plan state anywhere
- `locked` triggers paywall
- Existing premium users unaffected

**Deploy** None.

---

### P54 — Day-4 lockout enforcement

**Problem**
Trial users after day 3 should be locked out. Currently no enforcement.

**Fix**
Add `enforceSubscription` helper to `_shared/scale-guard.ts`:
```typescript
export async function enforceSubscription(
  supabaseAdmin: any, userId: string,
): Promise<{ allowed: true } | { allowed: false; reason: 'locked' | 'expired' }> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('status, plan, trial_end')
    .eq('user_id', userId)
    .single();
  if (!data) return { allowed: false, reason: 'locked' };
  if (data.status === 'trialing') {
    if (data.trial_end && new Date(data.trial_end) < new Date()) {
      return { allowed: false, reason: 'expired' };
    }
    return { allowed: true };
  }
  if (data.status === 'active' && data.plan === 'premium') return { allowed: true };
  return { allowed: false, reason: 'locked' };
}

export function subscriptionLockedResponse(reason: string, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'subscription_required', reason }), {
    status: 402, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
```

Every AI function calls this after rate-limit, before expensive work:
```typescript
const sub = await enforceSubscription(serviceClient, userId);
if (!sub.allowed) return subscriptionLockedResponse(sub.reason, CORS_HEADERS);
```

**Files**
- `supabase/functions/_shared/scale-guard.ts`
- All AI functions (~20 consumers)

**Acceptance**
- Trial day-4 users get 402 responses
- Active premium users unaffected
- Locked users directed to paywall

**Deploy** All AI functions (batch across sessions).

---

### P55 — Paywall page with Restore Purchase

**Problem**
Spec: paywall must have visible "Restore Purchase" button (App Store requirement).

**Fix**
Update `src/components/PaywallModal.tsx` (or new page `src/pages/Paywall.tsx`):
- Hero copy: trial ended / subscribe to continue
- Two plan cards (monthly 119 SEK / yearly 899 SEK)
- Primary CTA: "Start subscription" → Stripe checkout
- Secondary CTA: "Restore Purchase" → calls `restore_subscription` edge function
- Required by Apple for iOS App Store approval

**Files**
- `src/components/PaywallModal.tsx`
- `src/pages/marketing/Paywall.tsx` (if separate page)

**Acceptance**
- Paywall displays both CTAs
- Restore flow calls `restore_subscription`, updates subscription state, redirects to home if active found

**Deploy** None.

---

### P56 — SEK pricing in Stripe

**Problem**
Current Stripe setup may have USD prices. Spec: 119 SEK/month, 899 SEK/year.

**Fix**
1. In Stripe Dashboard: create two new SEK prices on existing Product
2. Update env vars:
   - `STRIPE_PRICE_ID_MONTHLY_LIVE` / `_TEST` → SEK price IDs
   - Same for YEARLY
3. Deploy `create_checkout_session` + `stripe_webhook` to pick up new env

**Files**
- `.env.example` (document)
- No code changes if env vars already used (verify)

**Acceptance**
- Checkout shows SEK amounts (119 / 899)
- Webhook processes SEK subscriptions correctly

**Deploy** `create_checkout_session`, `stripe_webhook`

---

### P57 — Credit priority verification

**Problem**
Spec: credit consume priority is trial_gift → monthly → topup. Need to verify `reserve_credit_atomic` RPC implements this.

**Fix**
1. Inspect the RPC in DB: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'reserve_credit_atomic'`
2. Verify priority order in the function body
3. If incorrect: migration to update the RPC

Likely already correct per `render-credits.ts` comments. Verify only.

**Files**
- Possibly new migration if RPC needs correction

**Acceptance**
- Test: user with 3 trial_gift + 20 monthly + 5 topup → first 3 reserves consume trial_gift, next 20 consume monthly, last 5 consume topup
- All balances end at 0

**Deploy** None (if RPC already correct)

---

