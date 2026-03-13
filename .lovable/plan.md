

# "Use Unused Garments" — Generate 6 Outfits Page

## What
Tapping "Use them today" on the SmartInsightCard navigates to a new `/outfits/unused` page that generates 6 outfits prioritizing the user's unused garments (not worn in 30 days). Each outfit is displayed as a card; tapping one navigates to its detail page.

## Architecture

### 1. New page: `src/pages/UnusedOutfits.tsx`
- Fetches unused garment IDs from `useInsights()` 
- On mount, calls `burs_style_engine` 6 times (or a batch approach) with `prefer_garment_ids` param containing unused garment IDs
- Shows a loading skeleton grid while generating
- Displays 6 outfit cards (2-column grid) with garment thumbnails, occasion label, and explanation
- Each card links to `/outfits/{id}`
- Back button returns to Home

### 2. Update `SmartInsightCard` → navigate on click
- Replace `onUseUnused` prop callback with `useNavigate` to `/outfits/unused`

### 3. Update Home.tsx
- Remove the unused `onUseUnused` prop (it wasn't wired anyway)

### 4. Add route in `AnimatedRoutes.tsx`
- `/outfits/unused` → `<ProtectedRoute><UnusedOutfits /></ProtectedRoute>`

### 5. Backend: Update `burs_style_engine` edge function
- Accept optional `prefer_garment_ids: string[]` parameter
- When provided, boost scoring for those garments so they're prioritized in outfit generation
- This is a small addition to the existing scoring logic (~5 lines)

### 6. New hook: `useUnusedOutfitGenerator` in the page
- Calls `burs_style_engine` 6 times sequentially with different occasions (vardag, jobb, dejt, etc.) + `prefer_garment_ids`
- Saves each generated outfit and collects results
- Manages loading/error state

## Files to create/edit
- **Create** `src/pages/UnusedOutfits.tsx` — new page with 6-outfit grid
- **Edit** `src/components/home/SmartInsightCard.tsx` — navigate to `/outfits/unused`
- **Edit** `src/components/layout/AnimatedRoutes.tsx` — add route
- **Edit** `supabase/functions/burs_style_engine/index.ts` — accept `prefer_garment_ids` boost
- **Edit** `src/pages/Home.tsx` — clean up unused prop

