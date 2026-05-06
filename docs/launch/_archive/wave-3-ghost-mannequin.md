## Wave 3 — PhotoRoom Removal + Ghost Mannequin for All Categories

### P15 — Unwire PhotoRoom entirely

**Problem**
- `supabase/functions/process_garment_image/index.ts` is a stub returning `{ok: true, skipped: true}` on every call. Never does real work.
- `src/lib/garmentIntelligence.ts:425` still invokes it on every garment save (1s timeout). Wasted HTTP round-trip.
- `src/pages/GarmentDetail.tsx` polls `image_processing_status` — but that status is always `'ready'` immediately. Redundant.
- `process_job_queue.ts` `handleImageProcessing` handler is also dead.

**Fix**
1. Delete the edge function:
   ```bash
   rm -rf supabase/functions/process_garment_image/
   ```
2. Remove from `supabase/config.toml` if listed.
3. In `src/lib/garmentIntelligence.ts`:
   - Delete `startGarmentImageProcessingInBackground` function (lines ~420-440)
   - Remove the `void startGarmentImageProcessingInBackground(...)` call site.
4. In `src/pages/GarmentDetail.tsx`:
   - Remove `garment?.image_processing_status === 'pending'` / `'processing'` from the `shouldPoll` calculation.
   - Keep `render_status === 'pending'/'rendering'` polling.
5. In `supabase/functions/process_job_queue/index.ts`:
   - Remove `image_processing: handleImageProcessing` from `JOB_HANDLERS`.
   - Delete `handleImageProcessing` function.
6. DB columns (`image_processing_status`, `image_processing_provider`, `image_processing_confidence`, `image_processing_error`, `image_processed_at`, `processed_image_path`) — LEAVE IN PLACE for now. Separate decision whether to drop them in a future migration.

**Files**
- `supabase/functions/process_garment_image/` (DELETE)
- `supabase/config.toml`
- `src/lib/garmentIntelligence.ts`
- `src/pages/GarmentDetail.tsx`
- `supabase/functions/process_job_queue/index.ts`

**Acceptance**
- Garment save flow still works; no HTTP call to `process_garment_image`
- `GarmentDetail` polling terminates correctly based on `render_status` alone
- `process_job_queue` still handles `garment_enrichment` and `batch_analysis`
- Old DB columns remain (unused)

**Deploy** `npx supabase functions deploy process_job_queue --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P16 — Category-aware render prompts

**Problem**
`supabase/functions/render_garment_image/index.ts` uses ONE prompt template ("ghost mannequin") for every category. Shoes, bags, jewelry don't belong on a torso — current output is inconsistent.

**Fix**
In `render_garment_image/index.ts`, branch prompt by `garment.category` BEFORE calling Gemini:

```typescript
function buildPromptByCategory(garment: Garment, presentation: MannequinPresentation): string {
  const base = `Premium e-commerce product photography. Pure white background. Studio lighting. No text or watermarks.`;
  switch (garment.category) {
    case 'top':
    case 'bottom':
    case 'dress':
    case 'outerwear':
      return `${base} ${mannequinPresentationInstruction(presentation)} Garment shown as if worn by an invisible body — hollow, with natural drape and shape. Show the full front of the garment. No visible mannequin parts (no face, hands, feet).`;
    case 'shoes':
      return `${base} Single shoe or pair photographed at a 3/4 angle, side view preferred. No person, no mannequin, no feet. Clean product-catalog styling.`;
    case 'accessory':
      const sub = garment.subcategory || '';
      if (['bag', 'handbag', 'backpack'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Bag photographed front-on, strap/handle naturally positioned. No person, no mannequin.`;
      }
      if (['scarf', 'hat', 'beanie', 'gloves'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Styled flat lay, garment arranged aesthetically against white.`;
      }
      if (['jewelry', 'watch', 'ring', 'necklace', 'bracelet'].some(s => sub.toLowerCase().includes(s))) {
        return `${base} Close-up product shot. No body parts visible. Clean white background, soft studio lighting.`;
      }
      return `${base} Styled product shot of the accessory against pure white.`;
    default:
      return `${base} Product photography of this garment against pure white background.`;
  }
}
```

Use this in place of the existing prompt construction. Keep `mannequinPresentationInstruction` for categories that use ghost mannequin.

**Files**
- `supabase/functions/render_garment_image/index.ts`
- `supabase/functions/_shared/mannequin-presentation.ts` (keep existing, extend if needed)

**Acceptance**
- Ghost mannequin categories (top/bottom/dress/outerwear) produce the same output as before
- Shoes produce clean product-angle shots, no mannequin
- Bags produce product shots with handles
- Accessories get context-appropriate rendering
- Spot-check 3 renders per category after deploy

**Deploy** `npx supabase functions deploy render_garment_image --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

---

### P17 — Multi-prompt retry chain

**Problem**
`render_garment_image` makes 1 attempt. On failure, marks `render_status='failed'` and the user sees nothing changed. No retry with different prompt strategy.

**Fix**
Wrap the Gemini call in a retry loop with 3 distinct prompt variants:

```typescript
const promptVariants = [
  buildPromptByCategory(garment, presentation),                    // primary
  buildPromptByCategory(garment, presentation) + ' Emphasize clean product-catalog framing.',  // tightened
  `Premium product photography against pure white. Single ${garment.category}. No person. Clean studio light. Subject: ${garment.title}.`,  // fallback
];

let result: GenerateGeminiImageResult | null = null;
let lastError: Error | null = null;

for (let attempt = 0; attempt < promptVariants.length; attempt++) {
  try {
    result = await generateGeminiImage({
      apiKey: GEMINI_API_KEY,
      prompt: promptVariants[attempt],
      dataUrl: sourceDataUrl,
      garmentId: garment.id,
    });

    // Validate output
    const validation = await validateRenderedGarmentOutputWithGemini({
      apiKey: GEMINI_API_KEY, garmentId: garment.id,
      mimeType: result.mimeType, imageBase64: base64(result.outputBytes),
    });

    if (validation.decision === 'accept') break;
    // rejected — fall through to next attempt
    lastError = new Error(`Validation rejected on attempt ${attempt + 1}: ${validation.reason}`);
    result = null;
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    result = null;
  }
}

if (!result) {
  // Final fallback: mark render_status='fallback', keep original image
  await supabase.from('garments').update({
    render_status: 'fallback',
    render_error: lastError?.message || 'All retries exhausted',
  }).eq('id', garment.id);
  return { ok: false, fallback: true };
}
```

**Files**
- `supabase/functions/render_garment_image/index.ts`

**Acceptance**
- Transient Gemini failures recover on retry 2 or 3
- Persistent failures produce `render_status='fallback'`, user sees original photo
- No silent user-facing failures

**Deploy** `render_garment_image`

---

### P18 — Tighten validateRenderedGarmentOutputWithGemini

**Problem**
`supabase/functions/_shared/render-eligibility.ts` `validateRenderedGarmentOutputWithGemini` uses the SAME reject-list for every category. Can't reject "shoe on mannequin" specifically because mannequin-visible is expected to fail for shoes (they should never involve a mannequin).

**Fix**
Make validation category-aware:
```typescript
export async function validateRenderedGarmentOutputWithGemini(opts: {
  apiKey: string; garmentId: string; mimeType: string; imageBase64: string;
  category?: string;    // NEW
}): Promise<RenderOutputValidationAssessment | null> {
  const isGhostMannequinCategory = ['top', 'bottom', 'dress', 'outerwear'].includes(opts.category || '');

  const promptText = isGhostMannequinCategory
    ? [/* existing ghost-mannequin validation prompt */]
    : [
        'Validate whether this rendered product image is acceptable for BURS wardrobe display.',
        'Return JSON only.',
        'Category:', opts.category,
        'Accept only: single garment or accessory on pure white background, clean product framing, no visible person/body/mannequin.',
        'Reject if: person visible, body parts visible, messy background, multiple garments, text/watermarks.',
        'Required schema: same as before.',
      ];
  // ... rest unchanged, use promptText
}
```

Caller (`render_garment_image`) passes `category: garment.category`.

**Files**
- `supabase/functions/_shared/render-eligibility.ts`
- `supabase/functions/render_garment_image/index.ts` (pass category)

**Acceptance**
- Shoe renders that show a mannequin get rejected
- Ghost mannequin renders that show a body get rejected
- Valid renders pass

**Deploy** `render_garment_image`

---

### P19 — Add timeouts to gemini-image-client.ts + render-eligibility.ts

**Problem**
Both files use `fetch()` with NO timeout. A hung Gemini request can tie up an edge function isolate indefinitely.

**Fix**
Wrap fetches with AbortController:
```typescript
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```
Use `fetchWithTimeout` everywhere `fetch` is called in these two files. Suggested timeouts:
- `gemini-image-client.ts` image gen: 60000ms (image gen is slow)
- `render-eligibility.ts` assessment/validation: 25000ms (text-based, should be fast)

**Files**
- `supabase/functions/_shared/gemini-image-client.ts`
- `supabase/functions/_shared/render-eligibility.ts`

**Acceptance**
- Slow Gemini responses get cancelled at the timeout, don't leak memory
- Normal responses (< timeout) unaffected

**Deploy** `render_garment_image`, and any other function importing these modules (grep to find all).

---

