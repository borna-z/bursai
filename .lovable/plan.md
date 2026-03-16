

## Current UX Issues

The `OutfitGenerate.tsx` page currently presents all decisions simultaneously — mode toggle, 6 emoji occasion cards in a 3×2 grid, 4 style groups with ~18 chips, weather card, and a floating CTA. This creates a "filter form" feeling rather than a guided stylist experience. Emoji icons (`👕`, `🎉`, `❤️`) clash with the Scandinavian editorial aesthetic. There's no progressive disclosure or decision hierarchy.

---

## Redesigned Flow

A single-page, stepped experience using **scroll-based progressive reveal** (not a wizard/stepper — everything lives on one scrollable page but sections unlock sequentially with gentle animation).

```text
┌─────────────────────────────────────┐
│  Header: "Let me style you"         │
│  Weather context strip (integrated) │
├─────────────────────────────────────┤
│  STEP 1: Mode                       │
│  Two editorial cards:               │
│  "Quick Look" vs "Stylist Mode"     │
├─────────────────────────────────────┤
│  STEP 2: Occasion (reveals after    │
│  mode is selected)                  │
│  6 text-only buttons, clean grid    │
│  No emojis, Lucide icons only       │
├─────────────────────────────────────┤
│  STEP 3: Style refinement           │
│  (optional, collapsed by default)   │
│  "Add a style direction" toggle     │
│  Shows max 6 curated chips          │
├─────────────────────────────────────┤
│  Sticky CTA bar at bottom           │
│  "Style me" with context subtitle   │
└─────────────────────────────────────┘
```

---

## Implementation Plan

### 1. Rewrite `src/pages/OutfitGenerate.tsx`

**Header & Weather Integration:**
- Replace generic header with editorial headline: context-aware based on time of day
- Integrate weather as a subtle inline strip below the headline showing temp, location, and a styling note (e.g., "Light layers recommended") — not a separate card

**Step 1 — Mode Selection:**
- Two side-by-side editorial cards (not toggle chips)
- "Quick Look": Sparkles icon, "Fast, balanced, everyday" subtitle
- "Stylist Mode": Crown icon, "Deeper curation, editorial picks" + Premium badge if not subscribed
- Selected state: `border-primary` + subtle `bg-primary/5`

**Step 2 — Occasion:**
- Replaces emoji grid with clean text+icon buttons
- 6 occasions using Lucide icons: `Briefcase` (Work), `Coffee` (Casual), `Wine` (Evening), `Heart` (Date), `Dumbbell` (Workout), `Plane` (Travel)
- Single-column or 2-column layout, larger touch targets
- Selected state: filled background + checkmark indicator
- Uses `motion.div` with `AnimatePresence` for gentle reveal

**Step 3 — Style (optional):**
- Collapsed by default with "Add a style direction" text button
- When expanded, shows a **single flat row** of max 6-8 curated styles (merged from current 4 groups into one smart list)
- Selecting is optional; subtitle says "Leave empty for a balanced look"
- Toggle behavior: tap to select, tap again to deselect

**Weather context note:**
- A single line below the header: `"{temp}° in {city} — {styling advice}"`
- Styling advice derived from weather: "Layer up", "Light & breathable", "Rain-ready fabrics"

**CTA:**
- Sticky bottom bar with frosted glass (`backdrop-blur-2xl`)
- Shows selected context as subtitle: "Casual · Minimal · 18°C"
- "Style me" button, full width, premium feel
- Remaining outfits count for free users

**Generating/Error phases:** Keep existing logic, no changes needed.

### 2. Files Changed

| File | Change |
|---|---|
| `src/pages/OutfitGenerate.tsx` | Full rewrite of the picking phase UI |

No changes to hooks, edge functions, routing, auth, or subscriptions. All generation logic (`useOutfitGenerator`, `handleGenerate`) stays identical — only the presentation layer changes.

### 3. Key Design Decisions

- **No emojis anywhere** — all icons from Lucide
- **Progressive disclosure** — style section starts collapsed
- **Fewer visible choices** — 6 occasions (icon+text, no gradients), 6-8 styles (single row)
- **Weather as context, not a card** — inline strip with styling implication
- **Mode selection is first** — sets the tone before occasion picking
- **Square edges in light mode** per brand guidelines (`rounded-none` or `rounded-sm` for cards, keeping `rounded-xl` only for interactive elements)
- **Editorial typography** — `label-editorial` for section labels, `tracking-[-0.03em]` for headlines

