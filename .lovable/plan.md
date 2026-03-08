

# Localized Pricing — ✅ DONE

## Display prices (landing, pricing page, paywall, premium section)

All pricing surfaces use `src/lib/localizedPricing.ts` to show locale-appropriate amounts:

| Language | Currency | Monthly | Yearly |
|----------|----------|---------|--------|
| sv, no | SEK/NOK | 59 kr | 499 kr |
| da | DKK | 39 kr | 329 kr |
| fi, de, fr, es, it, pt, nl, fa | EUR | €4,99 | €44,99 |
| en | GBP | £3.99 | £34.99 |
| pl | PLN | 19,99 zł | 179 zł |
| ar | AED | 19 د.إ | 169 د.إ |

## Stripe checkout (multi-currency charging)

The `create_checkout_session` edge function maps `locale` → currency-specific Stripe Price IDs so users are charged in their local currency (not just SEK).
