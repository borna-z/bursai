

# Fix Stripe Checkout — Test Price IDs Used with Live Key

## Problem
The edge function logs show this error:
```
No such price: 'price_1TAVuvRfXibG26O7DJR2wkuI'; a similar object exists in test mode, but a live mode key was used to make this request.
```

`STRIPE_MODE` is set to `live`, so the live secret key is used. But the `CURRENCY_PRICES` map (lines 41-63 in `create_checkout_session/index.ts`) contains **test-mode** price IDs. When the user's locale matches `en` (or any locale in that map), a test price ID is selected and sent to the live Stripe API, which rejects it.

## Root Cause
The `CURRENCY_PRICES` constant was populated with test-mode Stripe price IDs. These only work with `STRIPE_SECRET_KEY_TEST`. In live mode, the corresponding live price IDs must be used instead.

## Fix

### Option A — Create live prices in Stripe and update the map
You need to create matching live-mode prices in your Stripe dashboard for each currency (USD, GBP, EUR, NOK, DKK, PLN, AED), then replace every price ID in the `CURRENCY_PRICES` map with the live-mode equivalents.

### Option B — Switch back to test mode while setting up
Set `STRIPE_MODE` secret to `test` until all live prices are created and verified.

## Recommended Action
1. Use the Stripe tools to **list existing live-mode prices** to see which ones already exist.
2. For any missing currencies, **create live-mode prices** via the Stripe tools.
3. **Update `CURRENCY_PRICES`** in `supabase/functions/create_checkout_session/index.ts` with the correct live price IDs.
4. Redeploy the edge function.

### File change: `supabase/functions/create_checkout_session/index.ts`
- Lines 41-63: Replace all price IDs in `CURRENCY_PRICES` with the live-mode equivalents obtained from Stripe.

No database or frontend changes needed — the issue is entirely in the edge function's hardcoded price ID mapping.

