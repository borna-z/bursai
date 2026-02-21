

## 30-Day Free Trial Campaign -- Landing Page + Stripe Integration

### What this does
Adds a **30-day free trial** to the Premium subscription. New customers sign up, get full Premium access immediately, and are only charged after 30 days. If they cancel before the trial ends, they pay nothing.

### Changes

#### 1. Stripe Checkout -- Add `trial_period_days: 30`
**File: `supabase/functions/create_checkout_session/index.ts`**

Add `subscription_data: { trial_period_days: 30 }` to the `stripe.checkout.sessions.create()` call. This tells Stripe to give 30 free days before the first charge.

Also add `payment_method_collection: 'always'` so Stripe still collects a card upfront (required for auto-charging after the trial).

#### 2. Stripe Webhook -- Handle `trialing` status as premium
**File: `supabase/functions/stripe_webhook/index.ts`**

The `updateSubscription` helper currently maps subscription status to plan. Ensure `trialing` is treated as `premium` (same as `active`). This may already work but needs verification and explicit handling.

#### 3. Landing Page -- Campaign hero banner + updated pricing section
**File: `src/pages/Landing.tsx`**

- Add a **campaign banner** below the hero: a highlighted strip announcing "Try Premium free for 30 days -- no commitment."
- Update the Premium pricing card (line 237-261) to prominently show the trial offer:
  - Add "30 days free" badge replacing "Popular"
  - Show "Then 79 kr/month" as secondary text
  - Keep the "Start Free Trial" button text

#### 4. Pricing Page -- Add trial messaging
**File: `src/pages/Pricing.tsx`**

- Add a trial banner at the top of the page
- Update the Premium card to show "First 30 days free" prominently
- Update button text to emphasize the free trial

#### 5. PaywallModal -- Add trial messaging
**File: `src/components/PaywallModal.tsx`**

- Add "30 days free" text to the upgrade buttons
- Update monthly button label to "Start 30-day free trial"

#### 6. PremiumSection -- Add trial messaging
**File: `src/components/PremiumSection.tsx`**

- Update the monthly upgrade button to mention the free trial
- Show trial status if user is currently in trial period

#### 7. Translation keys
**File: `src/i18n/translations.ts`**

Add new keys for trial-related text in both Swedish and English:
- `trial.banner_title` / `trial.banner_desc`
- `trial.badge`
- `trial.then_price`
- `trial.start_button`
- `trial.active_badge`

### Technical details

**Stripe checkout session change:**
```typescript
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  subscription_data: {
    trial_period_days: 30,
  },
  payment_method_collection: 'always',
  success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/billing/cancel`,
  metadata: { ... },
});
```

**Webhook -- trialing status mapping:**
```typescript
const plan = ['active', 'trialing'].includes(subscription.status) ? 'premium' : 'free';
```

**Landing page campaign banner (after hero, before "How it works"):**
A full-width section with a subtle gradient background, large "30 days free" headline, supporting text, and a CTA button. Clean Scandinavian style matching the existing design language.

### Files summary
1. `supabase/functions/create_checkout_session/index.ts` -- add `trial_period_days: 30`
2. `supabase/functions/stripe_webhook/index.ts` -- ensure `trialing` = premium
3. `src/pages/Landing.tsx` -- campaign banner + updated pricing card
4. `src/pages/Pricing.tsx` -- trial messaging in pricing page
5. `src/components/PaywallModal.tsx` -- trial text on buttons
6. `src/components/PremiumSection.tsx` -- trial text + trial status display
7. `src/i18n/translations.ts` -- new translation keys
