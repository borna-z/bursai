

# Outfits Redesign + Wardrobe Cleanup + Test Data

## Analysis

**Current problems:**
1. **Outfits page** (`/outfits`) is a separate page with its own layout, tabs (Recent/Saved/Planned), and navigation — but it duplicates what's already inside the Wardrobe page's "Outfits" tab (`WardrobeOutfitsTab`).
2. **BottomNav** has 5 tabs including a dedicated "Outfits" tab pointing to `/outfits`. This is redundant — outfits are a sub-view of wardrobe, not a standalone destination.
3. The Wardrobe's `WardrobeOutfitsTab` is weak — just a flat grid of mini cards with a "Create reel" button. No filtering, no saved/planned distinction.
4. The standalone Outfits page cards are list-style with delete buttons, explanations — better content but wrong location.

**Design decision: Kill the standalone Outfits page. Merge into Wardrobe.**

The Wardrobe becomes the single source for "your stuff" — both garments and outfits. The BottomNav drops from 5 to 4 tabs (Today, Wardrobe, Plan, Stylist), which is cleaner and gives more thumb room.

## What the Outfits section in Wardrobe will look like

When user taps "Outfits" tab in Wardrobe:

1. **Segmented filter**: "All" | "Saved" | "Planned" — compact pill row at top
2. **Outfit cards in a 2-col grid**: Each card shows:
   - 2×2 garment image mosaic (aspect 1:1, rounded-xl)
   - Occasion badge below
   - Date (worn or planned) in muted text
   - Saved indicator (filled bookmark icon)
3. **Empty state**: Clean prompt to generate first outfit
4. **No "Create reel" button** — it's a gimmick, remove it
5. **Long-press to delete** via alert dialog (no persistent delete icons cluttering cards)
6. **Generate FAB**: When on outfits tab, the FAB changes to a Sparkles icon → navigates to Home to generate

## Plan

### 1. Remove standalone Outfits page from navigation
- **`src/components/layout/BottomNav.tsx`**: Remove the `/outfits` tab entry. 4 tabs: Today, Wardrobe, Plan, Stylist.
- **`src/components/layout/AnimatedRoutes.tsx`**: Keep `/outfits` route for deep links but it will redirect to `/wardrobe`. Remove the lazy import for Outfits page.

### 2. Redesign `WardrobeOutfitsTab` 
- **`src/components/wardrobe/WardrobeOutfitsTab.tsx`**: Full rewrite
  - Add "All / Saved / Planned" segmented filter
  - Redesign outfit cards: 2×2 image mosaic, occasion pill, date, saved icon
  - Long-press → delete dialog
  - Remove OutfitReel/Film button
  - Add delete functionality (import `useDeleteOutfit`)

### 3. Update Wardrobe FAB for outfits tab
- **`src/pages/Wardrobe.tsx`**: When `activeTab === 'outfits'`, show a Sparkles FAB that navigates to Home (outfit generation), instead of hiding the FAB entirely.

### 4. Redirect `/outfits` to `/wardrobe`
- Create a simple redirect component or update `Outfits.tsx` to redirect to `/wardrobe` with outfits tab pre-selected via state.

### 5. Generate 150 test garments
- Create and invoke a backend function to seed 150 garments with varied categories, colors, seasons, and image placeholders for the `bornaa8688` account.

## Files

| File | Change |
|------|--------|
| `src/components/layout/BottomNav.tsx` | Remove outfits tab (5→4) |
| `src/components/wardrobe/WardrobeOutfitsTab.tsx` | Full redesign with filters, better cards, delete |
| `src/pages/Wardrobe.tsx` | Show generate FAB on outfits tab |
| `src/pages/Outfits.tsx` | Replace with redirect to `/wardrobe?tab=outfits` |
| `src/components/layout/AnimatedRoutes.tsx` | Remove Outfits lazy import, keep route as redirect |
| Edge function or direct insert | Seed 150 garments for test account |

