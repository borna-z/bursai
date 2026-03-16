

# Add Style Selection Step to OutfitGenerate Page

## Overview
Rewrite `OutfitGenerate.tsx` to include an inline style/vibe picker with 18+ styles before generating. The page becomes a two-phase state machine: **pick** → **generating** (with auto-navigate on success). Uses existing `Chip` component for style grid, auto-fetches weather, and calls the existing `useOutfitGenerator` hook.

## Flow
1. User taps "What to wear" → lands on `/outfits/generate`
2. Page shows occasion chips (6) + style grid (18+) + weather auto-detected + Generate button
3. On tap Generate → shows `OutfitGenerationState` loading UI
4. On success → navigates to `/outfits/{id}`
5. On error → shows error card with retry

## Style Options (18)
Minimal, Street, Smart Casual, Classic, Sporty, Romantic, Bohemian, Preppy, Edgy, Retro, Scandinavian, Glamorous, Casual Chic, Monochrome, Layered, Relaxed, Avant-Garde, Coastal

## Changes

### `src/pages/OutfitGenerate.tsx` — Full rewrite
- State machine: `picking | generating | error`
- **Picking phase**: Show occasion chips (casual/work/party/date/workout/travel), style grid (18 chips in flex-wrap), auto weather from `useWeather`, Generate button
- **Generating phase**: Show `OutfitGenerationState` with subtitle
- **Error phase**: Show error card with retry/back buttons
- On success: `navigate(/outfits/{id}, { replace: true })`
- Remove dependency on `location.state` — page is now self-contained
- Keep wardrobe unlock gate

### `src/components/home/QuickActionsRow.tsx` — No change needed
Already points to `/outfits/generate`.

### `src/pages/Home.tsx` — No change needed  
Already navigates to `/outfits/generate` without state.

### Navigation references in `UsedGarments.tsx`
Keep as-is — it passes `garmentIds` in state which isn't used by the current generator anyway.

