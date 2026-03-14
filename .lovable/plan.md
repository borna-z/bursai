

# AI Suggestions Redesign

## Problems with Current Design
- Overlapping circles make garment images hard to read
- Layout feels cramped — occasion, title, circles, explanation, and buttons are all stacked in a tight column
- The overlapping circle pattern looks like a generic avatar stack, not a fashion-forward outfit preview
- No clear visual separation between the "what" (the outfit) and the "why" (explanation)

## New Design Direction

**Horizontal garment row with generous spacing** — instead of overlapping circles, show garments in a spaced-out horizontal scroll row with larger circles (~88px) that don't overlap. This lets users actually see each piece clearly.

**Card structure:**
```text
┌─────────────────────────────────────┐
│  ✦ AI SUGGESTIONS              ↻   │
│                                     │
│     SMART CASUAL · EVENING          │
│     The Minimalist Classic          │
│                                     │
│   ┌──┐  ┌──┐  ┌──┐  ┌──┐          │
│   │  │  │  │  │  │  │  │  ← scroll │
│   └──┘  └──┘  └──┘  └──┘          │
│   Polo  Trousers Sneakers Jacket    │
│                                     │
│  "Leans into your classic style…"   │
│                                     │
│  [ ──────── Try ──────── ] [ Plan ] │
│                                     │
│           ●  ○  ○                   │
└─────────────────────────────────────┘
```

### Key changes:
1. **Garment circles**: 88px, **no overlap**, spaced in a horizontal scrollable row with 12px gaps
2. **Garment labels**: Tiny category label below each circle (e.g. "Polo", "Trousers")
3. **Occasion badge**: Single line combining occasion tags with a centered dot separator
4. **Title**: Larger, 19px semibold, more breathing room above/below
5. **Explanation**: Stays subtle italic below garments, 2-line clamp
6. **Animations**: Staggered scale-in for each garment circle individually
7. **Premium gate**: Updated to match new non-overlapping layout

### Files to edit:
- `src/components/insights/AISuggestions.tsx` — full redesign of `GarmentStack`, `HeroSlide`, and premium gate

No translation changes needed. No hook changes needed.

