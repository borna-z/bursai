

# BURS Intelligence Blueprint — Implementation Plan

## Current State Assessment

The codebase is already substantial and well-architected:
- **Style Engine**: 3,687-line deterministic scoring engine with 10+ weighted factors, quality gate (8 rules), family deduplication, pair memory, social context, seasonal transitions, body-aware fit, and comfort/style learning
- **Garment Analysis**: Two-stage pipeline (fast + enrich) producing rich AI metadata (silhouette, visual_weight, texture_intensity, layering_role, versatility_score) stored in `ai_raw` JSONB
- **Chat**: Wardrobe-aware with 80-garment context, calendar events, weather, recent outfits, editorial voice
- **Travel Capsule**: AI-powered with deterministic fallback, tool-calling for structured output
- **Learning**: Pair memory, implicit feedback signals, wear pattern analysis, style vector, comfort/style profiles

**The critical gap**: The enrichment data (`ai_raw`) is generated and stored but **never used in the scoring engine**. The engine only reads basic columns (category, color, material, fit, formality). This is the single biggest intelligence upgrade available.

---

## Phase 1 — Unlock Enrichment Data in the Style Engine

**Goal**: Make the 3,687-line scoring engine use the rich garment intelligence already stored in `ai_raw`.

**File**: `supabase/functions/burs_style_engine/index.ts`

1. **Expand GarmentRow interface** to include enrichment fields from `ai_raw`:
   - `silhouette`, `visual_weight`, `texture_intensity`, `layering_role`, `versatility_score`, `occasion_tags`, `style_archetype`

2. **Fetch enrichment data**: Change the garment SELECT to include `ai_raw` and extract enrichment fields into the GarmentRow at load time (with safe defaults for unenriched garments).

3. **Upgrade `scoreGarment`** to use enrichment data:
   - **Occasion suitability**: Check `occasion_tags` against the requested occasion (bonus for match, penalty for mismatch)
   - **Layering role awareness**: Score `layering_role` against weather (base layers in warmth, outer layers in cold)
   - **Versatility boost**: Higher `versatility_score` garments get a small base score boost

4. **Upgrade combo scoring** (`scoreCombo`):
   - **Silhouette balance**: Use actual `silhouette` + `visual_weight` data. Penalize when all items are "boxy" or all "fitted". Reward contrast (e.g., relaxed top + straight bottom)
   - **Texture depth**: Use `texture_intensity` to ensure outfits have texture variety. Penalize flat (all smooth) or clashing (all bold) textures
   - Add these as new weighted factors in the combo score formula

5. **Upgrade quality gate**: Add rule for texture monotony (all items have same texture_intensity)

---

## Phase 2 — Travel Capsule Constrained Optimizer

**Goal**: Add deterministic pre-filtering and scoring before the AI call, making capsule generation smarter and more reliable.

**File**: `supabase/functions/travel_capsule/index.ts`

1. **Score pack-worthiness** per garment before sending to AI:
   - `versatility_score` from enrichment
   - Number of category-compatible pairings available
   - Weather coverage (does it work for the trip's temperature range?)
   - Material travel-friendliness (wrinkle tolerance heuristic: denim/knit > linen > silk)
   - Layering value

2. **Pre-filter garments**: Only send the top-scoring garments to AI (cap at ~40 most packable items), reducing AI input size and improving output quality.

3. **Matrix coverage validation**: After AI returns, verify that the capsule actually covers the requested outfit count with valid slot combinations. If gaps found, supplement from the pre-scored pack-worthy list.

---

## Phase 3 — Planner Week Intelligence

**Goal**: Make the planner generate week-aware outfits that respect spacing, calendar, and weather changes.

**Files**: `supabase/functions/burs_style_engine/index.ts`, `src/pages/Plan.tsx`

1. **Add `plan_week` mode** to the style engine:
   - Accept `days: { date, occasion, weather, events }[]`
   - Generate outfits sequentially, carrying forward a `used_garments` set
   - Apply inter-day repetition penalty: hero garments (top, dress, outerwear) used yesterday get heavy penalty, shoes/accessories lighter
   - Apply formality variation: if Monday=work and Saturday=weekend, ensure formality matches

2. **Expose backup options**: For each planned day, store the 2nd-ranked combo as a backup accessible via the UI

3. **Laundry-aware generation**: Cross-reference `in_laundry` garments with planned dates; if a planned garment is marked dirty, surface a warning and suggest the backup

---

## Phase 4 — Chat Intelligence Upgrade

**Goal**: Make the stylist chat answer with true wardrobe-grounded judgment.

**File**: `supabase/functions/style_chat/index.ts`

1. **Include enrichment data in wardrobe context**: Send `style_archetype`, `versatility_score`, `layering_role`, and `occasion_tags` per garment to the chat prompt (compact format)

2. **Add style cluster summary**: Before sending garment list, compute and include a wardrobe composition summary: "Your wardrobe leans relaxed-minimal with a strong neutral palette. Gaps: limited formal options, no rain-ready outerwear."

3. **Include rejection context**: Fetch the last 5 swap rejections and ignored suggestions to give the AI awareness of what the user has declined recently

---

## Phase 5 — Learning & Signal Refinement

**Goal**: Learn from real behavior more effectively.

**Files**: `supabase/functions/burs_style_engine/index.ts`, `src/hooks/useFeedbackSignals.ts`

1. **Track rejection reasons**: When a user swaps a garment, record what slot and what garment was rejected. When an outfit is regenerated without being saved, record as "ignored"

2. **Strengthen implicit signal integration**: Weight "wore it" signals 3x higher than "saved it" signals. Add "planned but didn't mark worn" as a weak negative signal

3. **Personal uniform detection**: In `buildStyleVector`, detect if >60% of worn outfits share the same silhouette formula (e.g., slim jeans + regular top + sneakers). If detected, boost that formula in scoring rather than forcing variety

---

## Phase 6 — UI Trust & Polish

**Goal**: Ensure no raw keys, malformed labels, or developer-facing text reaches the user.

**Files**: Multiple frontend components

1. **Audit all user-facing text**: Grep for raw enum values (e.g., `vardag`, `dejt`, `formell`) rendered in UI and ensure they pass through `getOccasionLabel()` or equivalent

2. **Per-attribute confidence in garment detail**: If `ai_raw` has a low confidence score, show a subtle "Confirm details" prompt on the garment detail page rather than auto-accepting

3. **Limitation note formatting**: Ensure `limitation_note` from the engine is rendered as editorial copy, not raw gap strings

---

## Implementation Order

| Phase | Scope | Risk | Priority |
|-------|-------|------|----------|
| 1 | Style engine enrichment | Low — additive scoring | Highest — unlocks stored intelligence |
| 2 | Travel capsule optimizer | Medium — changes AI input | High — direct quality improvement |
| 3 | Planner week intelligence | Medium — new mode | High — retention driver |
| 4 | Chat intelligence | Low — prompt changes | Medium |
| 5 | Learning refinement | Low — additive | Medium |
| 6 | UI polish | Low — frontend only | Medium |

Each phase is independently deployable and preserves all existing flows. No database migrations required — all enrichment data already exists in the `ai_raw` JSONB column.

