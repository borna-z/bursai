

## Redesign: Pricing Section — Editorial Minimal

### Design Direction

The current pricing section is a standard two-column card layout with a white premium card. It feels generic and disconnected from the editorial noir aesthetic of the rest of the landing page. As head of design, here's the new approach:

**Single-card hero pricing.** Instead of side-by-side Free vs Premium, lead with one bold Premium card — the thing we want to sell. Free is de-emphasized below as a text-only footnote. This follows the Apple Minimalism principle: one primary action per screen.

```text
┌─────────────────────────────────────┐
│          SIMPLE PRICING             │
│    One plan. Everything unlocked.   │
│                                     │
│      ┌─ Monthly / Yearly ─┐        │
│      │    toggle switch    │        │
│      └─────────────────────┘        │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   PREMIUM        30d free   │    │
│  │                             │    │
│  │   £2.91/mo  (billed yearly) │    │
│  │   ───────────────────────   │    │
│  │                             │    │
│  │   ∞ Garments    ∞ Outfits   │    │
│  │   AI Stylist    Planner     │    │
│  │   Insights      Flatlay     │    │
│  │                             │    │
│  │   [ Start Free Trial →    ] │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Or start free — 10 garments,       │
│  10 outfits/mo, basic AI.           │
│                                     │
│  ▾ Compare plans in detail          │
└─────────────────────────────────────┘
```

### Key Design Decisions

1. **Single centered premium card** — glass-panel style with subtle border glow, max-width ~480px. No white card; stays in the dark theme.
2. **Feature grid instead of list** — 6 features in a 2×3 or 3×2 grid of small icon+label cells. Cleaner than a bullet list.
3. **Price hierarchy** — Large equivalent monthly price as hero, small "billed yearly" annotation. Toggle switches between showing monthly vs yearly price.
4. **Trial badge** — Subtle pill in the top-right: "30 days free"
5. **Free plan as footnote** — One line of gray text below the card: "Or start free — 10 garments, 10 outfits/mo, basic AI." Links to /auth.
6. **Comparison table** — Stays as collapsible below, but gets a visual refresh: remove glass-panel, use simple alternating row opacity.
7. **Savings badge** — When yearly is selected, show a small amber pill next to the price with the savings percentage.

### Implementation Steps

1. **Rewrite `PricingSection.tsx`**
   - Single centered card layout with glass-panel + accent border glow
   - 2×3 feature grid using small icon chips (Infinity, Brain, Calendar, BarChart3, Image, Sparkles from lucide)
   - Large price display with monthly equivalent when yearly, raw monthly when monthly
   - Trial badge top-right
   - Free plan as a single text line below the card
   - CTA button with arrow icon

2. **Update `ComparisonTable.tsx`**
   - Cleaner row styling: remove glass-panel wrapper, use simple bordered rows
   - Slightly more compact padding

3. **No new translation keys needed** — reuse existing `landing.*` and `pricing.*` keys. The free footnote can combine existing keys inline.

4. **No changes to `localizedPricing.ts`** — pricing logic stays the same.

