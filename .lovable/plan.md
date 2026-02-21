

# Premium Spacing Refinement

## Goal
Increase breathing room across all app pages by bumping the core spacing tokens up one notch. This creates a calmer, more luxurious feel -- the same technique used by apps like Arc, Linear, and Apple's native iOS apps.

## What Changes

### 1. Page-level vertical rhythm: `space-y-5` --> `space-y-6`
Every main page container currently uses `space-y-5` (20px) between sections. Bumping to `space-y-6` (24px) adds exactly 4px more air between every section -- subtle but noticeable.

**Files:** `Home.tsx`, `Wardrobe.tsx`, `Plan.tsx`, `Settings.tsx`, `Insights.tsx`, `Outfits.tsx`, `GarmentDetail.tsx`, `OutfitDetail.tsx`

### 2. Page top padding: `pt-2`/`pt-4` --> `pt-6`
Add more air between the sticky header and the first content block. Currently some pages use `pt-2` (Home) and others `pt-4` (Wardrobe, Settings). Normalizing to `pt-6` (24px) across the board.

**Files:** Same as above

### 3. Section-internal spacing: `space-y-2` / `space-y-2.5` --> `space-y-3`
Inside each section (e.g. occasion chips, style chips, filter groups), bump from tight 8-10px to 12px.

**Files:** `Home.tsx` (occasion/style sections), `Wardrobe.tsx` (filter sections)

### 4. Card internal padding: `p-3` --> `p-4`, `p-2.5` --> `p-3`
Give card content more room to breathe. This affects stat cards, garment grid cards, insight cards, and settings rows.

**Files:** `Home.tsx` (stat cards, insight cards), `Wardrobe.tsx` (garment cards), `GarmentDetail.tsx`

### 5. Grid gaps: `gap-2` --> `gap-3` (stat grid), `gap-3` --> `gap-4` (garment grid)
Widen the space between grid items for a less cramped layout.

**Files:** `Home.tsx` (stats grid), `Wardrobe.tsx` (garment grid)

### 6. PageHeader height: `h-14` --> `h-16`
The shared header is the frame for every page. Adding 8px makes it feel more substantial and gives the title text more vertical breathing room.

**File:** `PageHeader.tsx`

### 7. Section label spacing: tighter tracking --> `mb-3`
Section labels like "What's on today?" currently sit close to their content. Adding a `mb-3` (or bumping `space-y-2.5` to `space-y-3`) under each label creates clearer visual hierarchy.

**Files:** `Home.tsx`, `Wardrobe.tsx`

## Summary of changes

| Token | Before | After | Delta |
|-------|--------|-------|-------|
| Page section gap | `space-y-5` (20px) | `space-y-6` (24px) | +4px |
| Page top padding | `pt-2` / `pt-4` | `pt-6` (24px) | +8-16px |
| Section inner gap | `space-y-2.5` | `space-y-3` (12px) | +2px |
| Card padding | `p-3` (12px) | `p-4` (16px) | +4px |
| Stat grid gap | `gap-2` (8px) | `gap-3` (12px) | +4px |
| Garment grid gap | `gap-3` (12px) | `gap-4` (16px) | +4px |
| PageHeader height | `h-14` (56px) | `h-16` (64px) | +8px |

## Technical Notes

- All changes are Tailwind class swaps -- no logic changes, no new components
- The 8pt grid alignment is preserved (all values are multiples of 4px)
- Bottom nav padding (`pb-20` / `pb-36`) remains unchanged since the nav height hasn't changed
- Estimated ~10 files modified with simple class replacements

