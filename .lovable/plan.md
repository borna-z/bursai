

# BURS AI Styling Engine v2 — Full Rebuild Plan

## What Exists Today (Weaknesses)

The current system delegates all styling logic to generic LLM prompts. There is no proprietary intelligence — just a prompt that says "you are a world-class stylist" and dumps the wardrobe list. Specific gaps:

1. **No color theory engine** — Color harmony is mentioned in prompts but not enforced. The swap scoring uses a naive "strong colors clash" check with hardcoded Swedish color names.
2. **No learning from feedback** — Ratings and feedback chips (too warm, too formal, etc.) are stored but never fed back into outfit generation.
3. **No style graph / garment compatibility** — No data structure tracks which garments pair well together based on past outfits and ratings.
4. **No seasonal intelligence** — Just a month-based hint string. No temperature-to-clothing-weight mapping.
5. **No wardrobe balance optimization** — Unused garment prioritization exists but is simplistic (30-day cutoff).
6. **No occasion-aware formality matching** — Formality values exist on garments but aren't systematically used.
7. **Swap candidates are naive** — Client-side scoring with basic color clash detection, no material/texture pairing.

## Architecture: Hybrid Intelligence Engine

The new system uses a **deterministic scoring engine + AI refinement** approach. The scoring engine runs server-side in the edge function, pre-filters and ranks candidates, then the AI makes the final creative selection from a curated shortlist. This makes the system faster, more consistent, and actually intelligent.

```text
┌─────────────────────────────────────────────────┐
│                 Client Request                   │
│  occasion, style, weather, date, locale          │
└──────────────────────┬──────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────┐
│           Edge Function: burs_style_engine       │
│                                                  │
│  1. CONTEXT ASSEMBLY                             │
│     - Wardrobe + wear history + feedback         │
│     - Calendar events for the date               │
│     - Weather forecast (temp, precip, wind)      │
│     - User style profile (quiz v3 data)          │
│     - Past outfit ratings & feedback             │
│                                                  │
│  2. DETERMINISTIC SCORING ENGINE                 │
│     a) Season/weather filter (eliminate unfit)    │
│     b) Formality matcher (occasion → range)      │
│     c) Color harmony scorer (HSL-based)          │
│     d) Wear rotation scorer (freshness)          │
│     e) Feedback learning (penalize patterns)     │
│     f) Style profile alignment                   │
│     g) Material/texture compatibility            │
│                                                  │
│  3. CANDIDATE ASSEMBLY                           │
│     - Top 5 candidates per slot, pre-scored      │
│     - Build top 10 viable outfit combos          │
│                                                  │
│  4. AI REFINEMENT (Gemini flash)                 │
│     - Pick best 1-3 from pre-scored combos       │
│     - Generate explanation                       │
│     - Much smaller prompt = faster + cheaper      │
│                                                  │
│  5. ANTI-REPETITION                              │
│     - Check against last 10 outfits              │
│     - Jaccard similarity filter                  │
└─────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New Edge Function: `burs_style_engine/index.ts`

Replaces `generate_outfit`. Single entry point for all outfit generation (today card, planner, suggestions).

**Core scoring modules (all deterministic, no AI needed):**

- **Color Harmony Engine**: Parse color names to HSL values using a 60-color lookup table. Score combinations using complementary (180°), analogous (30°), triadic (120°), and monochromatic rules. Neutral base + accent patterns get bonus points.

- **Weather-Garment Mapper**: Map temperature ranges to material weights and coverage levels. E.g., `<5°C → wool/fleece outerwear required`, `5-15°C → layerable mid-weight`, `15-25°C → cotton/linen single layer`, `>25°C → breathable/minimal`. Precipitation adds waterproof requirement.

- **Formality Matcher**: Map occasions to formality ranges (`vardag: 1-3, jobb: 2-4, fest: 3-5, dejt: 3-5, träning: 1-2`). Filter garments outside the range.

- **Wear Rotation Scorer**: Exponential decay based on days since last worn. Garments worn yesterday get 0 points, 7+ days ago get max. Bonus for never-worn items.

- **Feedback Learning**: Query past outfits with negative feedback. If "too warm" feedback exists for blazer+sweater combos at 18°C, penalize similar layering at similar temps. If "too formal" on chinos+oxford, reduce formality estimate for that combo.

- **Material Compatibility Matrix**: Hardcoded texture pairing rules. Denim pairs with cotton/leather, not silk. Wool pairs with cotton/cashmere, not athletic mesh. Prevents jarring texture mismatches.

- **Style Profile Alignment**: Score garments against user's stated preferences (favorite colors, fit preference, adventurousness level, comfort-vs-style slider).

**Combo Builder Algorithm:**
1. For each slot, score all available garments (composite of all scorers above)
2. Take top 5 per slot
3. Generate candidate outfits via cartesian product (top × bottom × shoes), pruned by inter-item compatibility
4. Score each combo holistically (color harmony across all items, formality consistency)
5. Apply anti-repetition filter (Jaccard similarity < 0.6 vs last 10 outfits)
6. Send top 8-10 combos to AI for final pick + explanation

### 2. Smarter Swap Engine

Move swap scoring to a new endpoint in `burs_style_engine` that uses the same color harmony + material compatibility logic. Given the other garments in the outfit, score replacements holistically rather than the current naive client-side approach.

### 3. Feedback Loop Integration

- Query `outfits` table for past ratings and feedback
- Build a per-user "preference model" at request time:
  - Color combos that got 4-5 stars → boost
  - Color combos that got 1-2 stars → penalize
  - Feedback tags → adjust weather/formality thresholds
- This makes the engine learn from every interaction without needing a separate ML pipeline

### 4. Frontend Changes

- **`useOutfitGenerator.ts`**: Point to new `burs_style_engine` endpoint. Add `mode` param (`generate`, `suggest`, `swap`).
- **`TodayOutfitCard`**: No major changes needed, just uses updated hook.
- **`QuickGenerateSheet`**: Pass through date for calendar-aware generation.
- **Swap flow**: Call engine instead of client-side scoring.

### 5. Database Migration

Add a `style_score` JSONB column to `outfits` table to store the engine's scoring breakdown (for debugging and future ML training):
```sql
ALTER TABLE outfits ADD COLUMN style_score jsonb DEFAULT NULL;
```

### 6. Config

Add new function to `supabase/config.toml`:
```toml
[functions.burs_style_engine]
verify_jwt = false
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/burs_style_engine/index.ts` | **Create** — New unified styling engine (~500 lines) |
| `src/hooks/useOutfitGenerator.ts` | **Modify** — Point to new endpoint |
| `src/hooks/useSwapGarment.ts` | **Modify** — Use engine endpoint for scoring |
| `src/hooks/useAISuggestions.ts` | **Modify** — Use engine in `suggest` mode |
| `supabase/config.toml` | **Modify** — Add function config |
| `supabase/functions/generate_outfit/index.ts` | **Keep** as fallback, deprecated |

## What Makes This "Smartest in Field"

1. **Hybrid approach** — Deterministic rules ensure consistency; AI adds creativity
2. **Real color theory** — HSL-based harmony, not string matching
3. **Learns from user** — Every rating and feedback tag improves future suggestions
4. **Weather-aware material logic** — Not just "it's cold, add a jacket" but actual material weight mapping
5. **Texture compatibility** — Prevents denim-on-denim or silk-with-athletic-mesh
6. **Anti-repetition with Jaccard** — Mathematical guarantee of variety
7. **Formality consistency** — No mixing a suit jacket with gym shorts
8. **Pre-scored combos** — AI gets curated options, not the full wardrobe dump, resulting in faster and better responses
9. **Occasion × calendar fusion** — If user has "Client meeting" on calendar, auto-elevate formality

