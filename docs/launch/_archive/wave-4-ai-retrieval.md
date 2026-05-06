## Wave 4 — AI Retrieval Quality

### P20 — Semantic pre-filter for mood_outfit

**Problem**
`mood_outfit/index.ts` sends ALL non-laundry garments to Gemini. Large wardrobes (>200 items) overwhelm the AI and hit token limits. Mood-irrelevant garments (formal suit for "cozy" mood) waste tokens.

**Fix**
Add a `scoreMoodFit(garment, mood)` function that returns 0-10 based on:
- Formality match (MOOD_MAP[mood].formality implies a range)
- Color match (MOOD_MAP[mood].colors string → check garment.color_primary)
- Material match (MOOD_MAP[mood].materials)
- Category appropriateness (dress→romantic, blazer→sharp, etc.)

Sort garments by score, take top 40 → send to Gemini. If fewer than 40 match, pad with next best.

```typescript
function scoreMoodFit(g: Garment, mood: string): number {
  const params = MOOD_MAP[mood];
  let score = 0;
  if (params.colors.toLowerCase().includes(g.color_primary?.toLowerCase() || '')) score += 4;
  if (params.materials && g.material && params.materials.includes(g.material.toLowerCase())) score += 3;
  if (params.formality === 'casual' && (g.formality || 3) <= 2) score += 2;
  if (params.formality === 'formal' && (g.formality || 3) >= 4) score += 2;
  return Math.min(10, score);
}

const scored = garments.map(g => ({ g, score: scoreMoodFit(g, mood) }))
  .sort((a, b) => b.score - a.score);
const topForAI = scored.slice(0, 40).map(x => x.g);
```

Send `topForAI` instead of full `garments` to the AI. Keep full list for post-validation.

**Files**
- `supabase/functions/mood_outfit/index.ts`

**Acceptance**
- Large wardrobes (>100 items) complete within token budget
- Top-40 contains mood-relevant items
- Output outfit still uses only IDs from the sent list

**Deploy** `mood_outfit`

---

### P21 — Gap-aware pre-filter for wardrobe_gap_analysis

**Problem**
`wardrobe_gap_analysis` sends full wardrobe to Gemini. It's asked to find GAPS (what's missing) but gets flooded with what exists — inverts the task.

**Fix**
Compute category coverage server-side first:
```typescript
const coverage = {
  top: garments.filter(g => g.category === 'top').length,
  bottom: garments.filter(g => g.category === 'bottom').length,
  shoes: garments.filter(g => g.category === 'shoes').length,
  outerwear: garments.filter(g => g.category === 'outerwear').length,
  dress: garments.filter(g => g.category === 'dress').length,
  accessory: garments.filter(g => g.category === 'accessory').length,
};
const colorCoverage = groupBy(garments, g => g.color_primary);
const formalityCoverage = { casual: ..., smart: ..., formal: ... };

const prompt = `User's wardrobe coverage (sparse view):
${JSON.stringify({ coverage, colorCoverage, formalityCoverage }, null, 2)}

Identify the top 5 gaps that would unlock the most new outfit combinations. Frame each as a specific piece (color + category + formality).`;
```

Send coverage summary + user's `styleProfile` (from preferences). Do NOT send full garment list.

**Files**
- `supabase/functions/wardrobe_gap_analysis/index.ts`

**Acceptance**
- AI returns gap recommendations as specific category+color+formality suggestions
- No need to send hundreds of garment rows to AI

**Deploy** `wardrobe_gap_analysis`

---

### P22 — Shopping-intent pre-filter for smart_shopping_list

**Problem**
Same pattern as P21 — sends entire wardrobe when the task is to recommend what to BUY.

**Fix**
Send compressed wardrobe signature + user's shopping preferences (budget tier, frequency, style goals from Q10 + Q11 onboarding). Not full inventory.

```typescript
const signature = {
  total: garments.length,
  byCategory: coverage,
  byColor: colorCoverage,
  gaps: detectWardrobeGapForRequest(garments),  // reuse burs_style_engine helper
  styleProfile: profile.preferences.styleProfile,
};

// Send signature + user intent, NOT full wardrobe
```

**Files**
- `supabase/functions/smart_shopping_list/index.ts`

**Acceptance**
- Token usage drops substantially on large wardrobes
- Suggestions still specific (category + color + formality)

**Deploy** `smart_shopping_list`

---

### P23 — Fix ID truncation

**Problem**
- `suggest_outfit_combinations/index.ts` line ~111: `unusedIds = unusedGarments.map(g => g.id.slice(0, 8))` — 8-char UUID prefix, collision risk.
- `wardrobe_aging/index.ts` line ~55-57: same `.slice(0, 8)` pattern on garment IDs in the prompt.

**Fix**
Use full UUIDs in prompts. If prompt length is a concern, use a numeric index instead:
```typescript
const idMap = new Map<number, string>();
const compactList = garments.map((g, i) => {
  idMap.set(i, g.id);
  return `${i}|${g.title}|${g.category}|${g.color_primary}`;
}).join('\n');

// Ask AI to return indices, then map back to full IDs in response validation
```
This keeps prompts compact AND avoids UUID collisions.

**Files**
- `supabase/functions/suggest_outfit_combinations/index.ts`
- `supabase/functions/wardrobe_aging/index.ts`

**Acceptance**
- No 8-char UUID slicing remains
- AI responses map back to correct full UUIDs
- Validate with a user who has 1000+ garments

**Deploy** Both functions.

---

### P24 — Enrichment guarantee

**Problem**
Every AI function can degrade quality if `ai_raw` enrichment fields are missing on garments. Currently no guarantee — if `garment_enrichment` jobs fail or lag, functions operate blind.

**Fix**
Add a helper in `_shared/burs-ai.ts`:
```typescript
export async function ensureEnriched(
  supabaseAdmin: any,
  garments: Array<{ id: string; enrichment_status?: string | null; ai_raw?: any }>,
): Promise<void> {
  const unenriched = garments.filter(g => !g.ai_raw || g.enrichment_status !== 'completed');
  if (unenriched.length === 0) return;

  // Queue enrichment jobs (fire-and-forget), don't block the AI call
  for (const g of unenriched) {
    await supabaseAdmin.rpc('submit_job_if_missing', {
      p_job_type: 'garment_enrichment',
      p_user_id: /* owner user_id */,
      p_payload: { garment_id: g.id },
    }).catch(() => {});
  }
  // Note: we don't wait. Next call will have richer data.
}
```

Call `ensureEnriched` at the start of every AI function that uses garments.

**Files**
- `supabase/functions/_shared/burs-ai.ts` (add helper)
- All AI function consumers (add 1-line call)
- New migration for `submit_job_if_missing` RPC (prevents double-queuing)

**Acceptance**
- First call with un-enriched garments queues enrichment jobs, still returns response (using basic fields)
- Second call has richer data

**Deploy** All AI functions importing burs-ai.

---

### P25 — Style DNA context injection

**Problem**
Every AI function writes its own system prompt. None consistently include the user's Style DNA (the 12-question onboarding answers). Without that context, Gemini can't tailor recommendations.

**Fix**
Depends on Wave 7 (P45) schema landing. Once `profiles.preferences.styleProfile` has v4 shape with Q1-Q12 answers, add to `_shared/burs-ai.ts`:
```typescript
export function buildStyleDNAContext(styleProfile: any): string {
  if (!styleProfile) return '';
  const parts: string[] = [];
  if (styleProfile.gender) parts.push(`Gender expression: ${styleProfile.gender}`);
  if (styleProfile.height) parts.push(`Height: ${styleProfile.height} cm`);
  if (styleProfile.build) parts.push(`Build: ${styleProfile.build}`);
  if (styleProfile.climate) parts.push(`Climate: ${styleProfile.climate}`);
  if (styleProfile.archetypes?.length) parts.push(`Style archetypes: ${styleProfile.archetypes.join(', ')}`);
  if (styleProfile.colorDNA?.favorites) parts.push(`Favorite colors: ${styleProfile.colorDNA.favorites.join(', ')}`);
  if (styleProfile.fit?.overall) parts.push(`Overall fit preference: ${styleProfile.fit.overall}`);
  if (styleProfile.formalityFloor && styleProfile.formalityCeiling) parts.push(`Formality range: ${styleProfile.formalityFloor}-${styleProfile.formalityCeiling}`);
  if (styleProfile.primaryGoal) parts.push(`Primary goal: ${styleProfile.primaryGoal}`);
  // ... etc
  return parts.join('. ');
}
```

In every AI function's system prompt, prepend `USER PROFILE: ${buildStyleDNAContext(profile.preferences.styleProfile)}`.

**Files**
- `supabase/functions/_shared/burs-ai.ts`
- All AI function consumers (~12 functions)

**Acceptance**
- Recommendations vary by user's Style DNA (test with two distinct profiles)
- Prompt length stays manageable (compressed signature, not verbose)

**Deploy** All AI functions.

---

### P26 — Remove slot: "unknown" hardcodes

**Problem**
- `supabase/functions/generate_outfit/index.ts` line 62: `slot: "unknown"` hardcoded for every returned item. Downstream code that relies on `slot` (OutfitDetail layer ordering, refine flow) breaks.
- `supabase/functions/_shared/unified_stylist_engine.ts` line 90: same pattern for `other_items`.

**Fix**
Use `classifySlot` from `_shared/burs-slots.ts` to infer the real slot from each garment's category/subcategory:
```typescript
import { classifySlot } from "../_shared/burs-slots.ts";

// generate_outfit:
items: selected.garment_ids.map((garment_id) => {
  const g = garmentMap.get(garment_id);
  return { slot: g ? classifySlot(g.category, g.subcategory) || 'unknown' : 'unknown', garment_id };
}),

// unified_stylist_engine:
other_items: activeLookIds.filter(id => id !== currentGarmentId).map(garmentId => {
  const g = garmentMap.get(garmentId);
  return { slot: g ? classifySlot(g.category, g.subcategory) || 'unknown' : 'unknown', garment_id: garmentId };
}),
```

Requires passing garment metadata to both functions. In `generate_outfit`, the burs_style_engine already returns garments — just enrich them in the shim. In `unified_stylist_engine`, fetch the garments first.

**Files**
- `supabase/functions/generate_outfit/index.ts`
- `supabase/functions/_shared/unified_stylist_engine.ts`

**Acceptance**
- `items[].slot` reflects real slot (top/bottom/shoes/etc.), not "unknown"
- Refine flow receives correct slot info

**Deploy** `generate_outfit` + every function importing `unified_stylist_engine` (e.g., `style_chat`).

---

### P27 — Full audit and fix of clone_outfit_dna retrieval

**Problem**
`supabase/functions/clone_outfit_dna/index.ts` was not deeply audited. Cache namespace issue fixed in P13 but retrieval strategy unverified.

**Fix**
1. Read the full file. Document in PR body:
   - What input does it take? (inspiration image? style description? both?)
   - What garments does it fetch and send to Gemini?
   - What does it return?
2. Apply the same patterns as other AI functions:
   - Pre-filter wardrobe by relevance to the inspiration (color, formality, category match)
   - Send top N, not all
   - Use full UUIDs
   - Include Style DNA context (P25)
   - Guarantee enrichment (P24)
3. If it's fundamentally a "copy this outfit style" function, ensure it returns full outfits (top+bottom+shoes or dress+shoes), not single garments.

**Files**
- `supabase/functions/clone_outfit_dna/index.ts`

**Acceptance**
- Function returns complete outfits
- Relevant pre-filter reduces AI token usage
- Documented in PR body

**Deploy** `clone_outfit_dna`

---

