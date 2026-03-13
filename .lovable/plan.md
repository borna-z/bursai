

# "What to Wear?" — Style Picker Page

## Problem
The "What to wear?" button in the QuickActionsRow navigates to `/generate`, which doesn't match any route (the actual generate route is `/outfits/generate` and requires pre-filled state). The button currently does nothing useful.

## Solution
Create a new **Style Picker** page at `/style-picker` with 15 distinct look/style options. When the user taps a look, it auto-generates an outfit using the existing `useOutfitGenerator` hook with the selected style and current weather, then navigates to the result.

## The 15 Looks
Organized in a 3-column grid with icons and short descriptions:
1. **Minimal** — Clean & simple
2. **Street** — Urban edge
3. **Smart Casual** — Polished but relaxed
4. **Classic** — Timeless elegance
5. **Sporty** — Active & fresh
6. **Romantic** — Soft & feminine
7. **Bohemian** — Free-spirited
8. **Preppy** — Polished & put-together
9. **Edgy** — Bold & daring
10. **Cozy** — Warm & comfortable
11. **Business** — Office-ready
12. **Party** — Night out glam
13. **Retro** — Vintage-inspired
14. **Scandi** — Nordic minimalism
15. **Athleisure** — Sport meets style

## Changes

### 1. New page: `src/pages/StylePicker.tsx`
- Grid of 15 style cards (3 columns, each with icon + name + short description)
- Uses `useWeather` for auto weather context
- On tap: calls `useOutfitGenerator.generateOutfit()` with `occasion: 'vardag'`, `style: selectedLook`, and current weather
- Shows generating state on the selected card (pulse badge like MoodOutfit page pattern)
- On success: navigates to `/outfits/${outfit.id}` with `justGenerated: true`
- Error handling via toast
- Includes `PageHeader` with back button, `AnimatedPage` wrapper, staggered card animations

### 2. `src/components/layout/AnimatedRoutes.tsx`
- Add lazy import for `StylePicker`
- Add protected route: `/style-picker`

### 3. `src/components/home/QuickActionsRow.tsx`
- Change path from `'/generate'` to `'/style-picker'` for the `what_to_wear` action

### 4. `src/i18n/translations.ts`
- Add translation keys for page title, subtitle, and all 15 look names + descriptions (English primary, Swedish secondary; other locales get English fallback)

