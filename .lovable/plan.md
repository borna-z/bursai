

## Redesign: Make 30-Day Trial Campaign Prominent in Pricing

The current pricing section already has the single-card layout, but the trial messaging is subtle — a small badge saying "0 kr" in the corner. The goal is to make the 30-day free trial the dominant visual element so visitors immediately understand the offer.

### Changes

**1. `PricingSection.tsx` — Enhanced trial visibility**

- Add a **hero trial banner** above the price: a full-width highlighted strip inside the card with the message "Try free for 30 days" (`trial.first_free`) in a larger, bolder style with a subtle amber/gold gradient background.
- Replace the small corner badge with a more prominent **campaign ribbon** that spans wider and uses bolder typography.
- Below the price, add a clear **step-by-step value proposition**: "30 days free → then {price}/mo" using `trial.then_prefix` and billing note, styled as a timeline/flow so the pricing journey is crystal clear.
- Update the CTA button text to reinforce the trial: use `trial.start_button` ("Start free trial") instead of generic `landing.start_trial`.
- Add a small **reassurance line** under the CTA: "No card required · Cancel anytime" using existing `trial.banner_desc`.

**2. `ComparisonTable.tsx` — Minor refinement**

- Add a small trial reminder in the Premium column header: append the trial badge text next to "Premium" so even in the comparison table visitors see the 30-day offer.

**3. No new translation keys needed** — all required strings already exist across all 14 languages (`trial.first_free`, `trial.then_prefix`, `trial.banner_desc`, `trial.start_button`, `landing.premium_badge`).

### Visual Hierarchy (top to bottom inside card)

```text
┌──────────────────────────────────┐
│  ★ 30 DAYS FREE (amber banner)  │
├──────────────────────────────────┤
│  PREMIUM                        │
│                                 │
│  £2.91/mo                       │
│  30 days free → then £34.99/yr  │
│  ────────────────────────────── │
│  ∞ Garments    ∞ Outfits        │
│  AI Stylist    Planner          │
│  Insights      Flatlay          │
│                                 │
│  [ Start Free Trial →         ] │
│  No card required · Cancel any  │
└──────────────────────────────────┘
```

No changes to `localizedPricing.ts` or translation files.

