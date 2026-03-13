

# Plan: Add "Outfits per Day" and "Must-Have Items" to Travel Capsule Form

## What We're Adding

Two new input sections in the Travel Capsule form (between Step 3 "Activities" and Step 4 "Preferences"):

### 1. Outfits Per Day Selector
A simple numeric stepper (1–4) letting the user choose how many outfit changes they need per day (e.g., 1 for casual trips, 2+ for business trips with evening events).

### 2. Must-Have Garments / Extras
A selection panel where users can pick specific garments from their wardrobe that **must** be included in the capsule (e.g., a favorite jacket, a formal dress). These will be sent to the edge function as required items.

## Changes

### 1. Frontend — `src/pages/TravelCapsule.tsx`
- Add two new state variables: `outfitsPerDay` (number, default 1) and `mustHaveItems` (string array of garment IDs)
- Add a new "Outfits per day" section with +/- stepper buttons (1–4 range)
- Add a "Must-have items" section with a scrollable row of garment thumbnails fetched from the user's wardrobe (using existing `useGarments` hook), tappable to toggle selection
- Pass both values (`outfits_per_day`, `must_have_items`) in the `handleGenerate` body to the edge function

### 2. Translations — `src/i18n/translations.ts`
- Add keys for both languages:
  - `capsule.outfits_per_day` / `capsule.outfits_per_day_desc`
  - `capsule.must_haves` / `capsule.must_haves_desc`

### 3. Backend — `supabase/functions/travel_capsule/index.ts`
- Read `outfits_per_day` and `must_have_items` from the request body
- Use `outfits_per_day` to calculate `targetOutfits = duration_days * outfits_per_day`
- Add must-have garment IDs to the AI prompt as required items and ensure they appear in `capsule_items`
- In the deterministic fallback, always include must-have items first
- Redeploy the edge function

