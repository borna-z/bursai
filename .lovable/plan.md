## Updated Pricing: 7s and 9s Strategy

All prices need to follow a "7 and 9" pattern. Here are the corrected values:


| Currency  | Monthly  | Yearly  | Currently         | &nbsp; | &nbsp; |
| --------- | -------- | ------- | ----------------- | ------ | ------ |
| USD ($)   | $7.99    | $69.99  | $6.99 / $59.99    | &nbsp; | &nbsp; |
| GBP (£)   | £7.99    | £69.99  | £6.99 / £59.99    | &nbsp; | &nbsp; |
| EUR (€)   | €7.99    | €69.99  | €6.99 / €59.99    | &nbsp; | &nbsp; |
| SEK (kr)  | 79 kr    | 699 kr  | ✅ Already correct | &nbsp; | &nbsp; |
| NOK (kr)  | 79 kr    | 699 kr  | ✅ Already correct | &nbsp; | &nbsp; |
| DKK (kr)  | 59 kr    | 499 kr  | 79 kr / 699 kr    | &nbsp; | &nbsp; |
| PLN (zł)  | 29.99 zł | 249 zł  | 34.99 / 399       | &nbsp; | &nbsp; |
| AED (د.إ) | 25 د.إ   | 219 د.إ | 34.99 / 299       | &nbsp; | &nbsp; |


### Changes

**1. Frontend display prices** — 2 files:

- `src/lib/localizedPricing.ts` — Update EUR, USD, GBP entries from 6.99/59.99 → 7.99/69.99
- `public/landing.html` — Same price strings updated in the inline `P` object

**2. Stripe Price IDs** — New Stripe prices need to be created for USD, GBP, and EUR at the new amounts (7.99/69.99), then the `CURRENCY_PRICES` map in `supabase/functions/create_checkout_session/index.ts` updated with the new IDs.

### Steps

1. Create new Stripe prices for EUR (7.99/69.99), USD (7.99/69.99), GBP (7.99/69.99)
2. Update `CURRENCY_PRICES` in `create_checkout_session/index.ts` with new price IDs
3. Update `localizedPricing.ts` display values
4. Update `landing.html` inline price strings