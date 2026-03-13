

## Fix Landing Pricing to 79 kr / 699 kr

### Problem
The landing page (`public/landing.html`) shows `$0` and `$9` as pricing — generic USD placeholders. The in-app pricing (`localizedPricing.ts`) also uses 59 kr / 499 kr instead of the correct 79 kr / 699 kr.

### Changes

**1. `public/landing.html`** (lines 651-678)
- Free card: Change `$0` → `0 kr`, keep "No credit card needed"
- Premium card: Change `$9` → `79 kr`, period text → `per month · cancel anytime` with a yearly note `or 699 kr/year (save 26%)`

**2. `src/lib/localizedPricing.ts`** (line 21)
- Update `sv` entry: `monthly: 59` → `79`, `yearly: 499` → `699`
- Update `no` entry similarly (same SEK/NOK pricing): `monthly: 59` → `79`, `yearly: 499` → `699`

### Files to edit
1. `public/landing.html` — Update pricing amounts in the pricing section
2. `src/lib/localizedPricing.ts` — Update sv/no price entries to 79/699

