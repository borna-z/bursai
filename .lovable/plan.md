

# Generate Unique Images for All Garments

## Problem
167 garments in the wardrobe share only ~33 unique images. Many garments like "Trench Coat #19", "Trench Coat #69", "Trench Coat #119" all point to the same `camel-overcoat.png`. The user wants every garment to have its own distinct image.

## Approach

Create a backend function that generates AI images for each garment based on its attributes (title, category, color, material), uploads them to storage, and updates the database record. Process in batches to avoid timeouts.

### 1. New Edge Function: `generate_garment_images/index.ts`

- Accepts a batch of garment IDs (10 at a time to stay within edge function timeout)
- For each garment, builds a prompt from its attributes: `"A single [color] [material] [title] clothing item on a clean white background, product photography, no model, flat lay"`
- Calls Gemini image generation (`google/gemini-2.5-flash-image`) with `modalities: ["image", "text"]`
- Decodes the base64 image, uploads to the `garments` storage bucket under `{user_id}/{garment_id}.png`
- Updates `garments.image_path` with the new path
- Returns progress/results for each garment

### 2. Frontend: Admin Trigger Button

- Add a temporary utility in the Settings page (or a standalone route) with a "Generate Unique Images" button
- Fetches all garments with duplicate `image_path` values
- Sends them to the edge function in batches of 10
- Shows a progress bar (X of 167 complete)
- Each batch waits for the previous to finish before starting the next

### 3. Batch Strategy

With 167 garments and ~5-8 seconds per image generation:
- Batches of 8 garments per edge function call
- ~21 batches total
- Progress UI shows current batch and overall completion
- Failed items are logged and can be retried

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/generate_garment_images/index.ts` | **Create** — AI image generation + storage upload |
| `src/pages/settings/GenerateImages.tsx` | **Create** — Admin utility page with progress UI |
| `src/App.tsx` | **Modify** — Add route for the utility page |

## Image Generation Prompt Template

Each garment gets a tailored prompt like:
> "Product photo of a single rust silk camp collar shirt, flat lay on pure white background, high-end fashion catalog style, clean minimal, no person, no model"

This ensures every image is visually distinct based on the garment's actual color, material, and type.

