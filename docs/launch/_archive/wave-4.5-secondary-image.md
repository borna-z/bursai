## Wave 4.5 — Secondary Image + Swap Primary (Product Feature)

Optional second image per garment, addable **only after the garment is already saved and rendered** — not part of the initial AddGarment flow. Once a secondary exists, the user chooses which image is the **primary / source of truth** via a one-tap swap. The primary drives:
- The wardrobe card display.
- Every AI consumer of `image_path` (analyze_garment enrichment, render_garment_image, outfit scoring — all read `image_path` today and continue to read `image_path` post-swap with zero code change).

Swap triggers re-enrichment + re-render so the AI outputs stay in sync with the new primary. Entirely opt-in per garment, no backfill.

### Design note — why swap VALUES, not a pointer column

Swap is implemented as a single atomic UPDATE that exchanges the values of `image_path` and `secondary_image_path`:

```sql
UPDATE "public"."garments"
SET image_path = secondary_image_path,
    secondary_image_path = image_path
WHERE id = $1 AND user_id = auth.uid();
```

This keeps `image_path` as the **universal source of truth**. Every reader — wardrobe card, `analyze_garment`, `render_garment_image`, outfit scoring, edge functions that fetch garments, React Query selectors — continues reading `image_path` with zero code changes. Alternative designs (a `primary_is_secondary` flag, a `primary_image_slot` enum) would require touching every single reader; the value-swap approach is O(1) in blast radius.

---

### P27a — Schema: nullable `secondary_image_path` on garments

**Problem**
Garments have a single `image_path`. There's no way to store an alternate image the user might prefer once they see the render.

**Fix**
1. New migration adds one column:
   ```sql
   ALTER TABLE "public"."garments"
     ADD COLUMN IF NOT EXISTS "secondary_image_path" "text";
   ```
   Nullable. No default. No CHECK constraint. Matches existing `original_image_path` / `processed_image_path` / `rendered_image_path` naming.
2. No storage-bucket migration — existing `garments` bucket reused. File convention: `${userId}/${garmentId}_secondary.jpg`.
3. No backfill. No swap RPC — swap is one atomic UPDATE (see design note above), executable from the Supabase JS client.

**Files**
- New migration `supabase/migrations/<ts>_garments_secondary_image.sql`

**Acceptance**
- `npx supabase migration list --linked` shows the new migration as Local-only until post-merge push.
- `npx supabase db push --linked --dry-run` lists exactly this migration.
- Existing rows unchanged; new column defaults to NULL.

**Deploy**
Post-merge from main: `npx supabase db push --linked --yes`. No edge-function redeploy (every consumer continues reading `image_path` — the new column is inert until wired up in P27b).

---

### P27b — Secondary image management: add, swap primary, delete (post-save, GarmentDetail only)

**Problem**
The column exists but there's no UI. Users can't add, swap, or remove a secondary.

**Fix**
Entry point is `src/pages/GarmentDetail.tsx` **only**. Do NOT touch `AddGarment.tsx`, `LiveScan.tsx` as a first-step, or onboarding — the feature is post-save-only per product spec.

**Guardrail** (applies to every action below): action is disabled while `render_status === 'pending' | 'rendering'` OR `enrichment_status === 'processing' | 'in_progress'`. Show a toast "Wait for current enrichment / render to finish" on disabled-click. This prevents racing the worker.

**Add secondary**
1. "Add alternate photo" button in GarmentDetail. Invokes the existing `LiveScan` capture component (no new Median-hook code — `useMedianCamera.ts`, `useMedianStatusBar.ts`, `src/lib/median.ts` stay frozen until Wave 9). Browser fallback to file input is already built into LiveScan.
2. Upload to `garments/${userId}/${garmentId}_secondary.jpg` in the existing `garments` bucket.
3. Single `UPDATE garments SET secondary_image_path = $1 WHERE id = $2 AND user_id = $3`.
4. Triggers NOTHING in the AI pipeline — the secondary is not the primary yet.
5. Haptic: `hapticLight()` on tap.

**Swap primary ↔ secondary**
1. "Use this as primary" button on the secondary preview.
2. Atomic UPDATE (see design note):
   ```sql
   UPDATE "public"."garments"
   SET image_path = secondary_image_path,
       secondary_image_path = image_path,
       enrichment_status = 'pending',
       ai_raw = NULL,
       ai_analyzed_at = NULL,
       ai_provider = NULL,
       silhouette = NULL,
       visual_weight = NULL,
       texture_intensity = NULL,
       style_archetype = NULL,
       occasion_tags = NULL,
       versatility_score = NULL,
       render_status = 'pending',
       rendered_image_path = NULL,
       rendered_at = NULL,
       render_error = NULL
   WHERE id = $1 AND user_id = auth.uid();
   ```
   RLS enforces ownership. Single statement = no intermediate state; a concurrent read sees either the pre-swap row or the post-swap row, never both.
3. Client-side enqueues:
   - Fresh enrichment via the same code path AddGarment uses today (likely `triggerGarmentPostSaveIntelligence` in `src/lib/garmentIntelligence.ts` — verify).
   - Fresh render job via `useEnqueueRenderJob.ts` (the existing hook — verify it handles the "already exists, being replaced" case; if not, extend).
4. Render credit ledger: swap consumes one render credit. This is expected behavior and called out in the PR body — the user asked for a fresh render based on a new source.
5. Haptic: `hapticLight()` on swap confirmation; toast "Primary photo updated — re-rendering…".

**Delete secondary**
1. "Remove" button on the secondary preview.
2. Supabase storage delete on `garments/${userId}/${garmentId}_secondary.jpg`.
3. `UPDATE garments SET secondary_image_path = NULL WHERE id = $1 AND user_id = $2`.
4. Triggers NOTHING in the AI pipeline — the secondary was not primary.

**UI**
- In GarmentDetail hero: primary image large (unchanged), small thumbnail of secondary adjacent with subtle "alternate" label.
- Tap secondary thumbnail → modal expansion with the two action buttons "Use as primary" and "Remove".
- Motion: `EASE_CURVE` from `src/lib/motion.ts` on the modal transition.

**Files**
- `src/pages/GarmentDetail.tsx`
- `src/components/garment/SecondaryImageManager.tsx` (new)
- `src/lib/garmentIntelligence.ts` (only if the existing trigger path needs a re-entrant variant — verify at scope time)
- `src/hooks/useEnqueueRenderJob.ts` (same — verify)

**Acceptance**
- With zero secondary: GarmentDetail shows "Add alternate photo" button; no secondary UI elsewhere.
- After add: secondary thumbnail appears; "Use as primary" and "Remove" work.
- After swap: primary image updates immediately (optimistic), enrichment + render re-fire, re-rendered image arrives and displays. The OLD primary is now the secondary — user can swap back.
- After delete: secondary thumbnail disappears, storage object gone, column NULL.
- Guardrail: action buttons disabled during in-flight enrichment/render with a toast on disabled-click.
- No Median-hook file is modified.
- Wardrobe card (`src/pages/Wardrobe.tsx`) and all AI edge functions are NOT modified (they read `image_path` and continue to read `image_path`).

**Deploy** none (backend untouched; pure client + DB work)

---

