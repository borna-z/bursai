

# Redesign: Settings Style Page

## Problem
The current style settings page shows all content at once -- body measurements, two separate color grids, fit/vibe selectors -- creating a dense, overwhelming layout that doesn't match the app's minimalist philosophy.

## Solution
Restructure into collapsible accordion sections using Radix Collapsible, and expand the color palette from 13 to 38+ colors with visual color swatches (small colored dots next to each name).

## Layout Structure

```text
+-----------------------------+
|  < Stil                     |
+-----------------------------+
|                             |
|  [ Kroppsmatt         v ]   |  <- collapsible
|    height / weight / save   |
|                             |
|  [ Favoritfarger      v ]   |  <- collapsible
|    38 color chips           |
|                             |
|  [ Ogillade farger     v ]  |  <- collapsible
|    38 color chips           |
|                             |
|  [ Passform & Stil    v ]   |  <- collapsible
|    fit / vibe / gender      |
|                             |
+-----------------------------+
```

## Changes

### File: `src/pages/settings/SettingsStyle.tsx`

1. **Replace flat layout with 4 collapsible sections** using Radix `Collapsible` (already installed). Each section has a header row that toggles open/closed with a chevron icon.

2. **Expand color palette** from 13 to 38+ colors. Add colors like:
   - Neutrals: ivory, kräm, sand, khaki, kolgrå, antracit
   - Blues: himmelsblå, turkos, petrol, indigo, kobolt
   - Greens: olivgrön, skogsgrön, mint, salviagrön
   - Reds/Pinks: vinröd, korall, aprikos, fuchsia, lavendel
   - Earths: kamel, rost, cognac, choklad, terrakotta
   - Others: guld, silver, kricka, plommon, senapsgul

3. **Add color dot swatches** next to each chip -- a small 10px circle showing the actual color, making selection more intuitive.

4. **Visual polish**:
   - Only one section open at a time (optional, could allow multiple)
   - Smooth height animation on expand/collapse
   - Chevron rotates on open
   - Selected count badge shown in the collapsed header (e.g., "Favoritfarger (3)")

### Color Map
A `COLOR_MAP` object will provide hex values for each color name, used to render the small dot swatch inside each `Chip`.

## Technical Details

| File | Change |
|------|--------|
| `src/pages/settings/SettingsStyle.tsx` | Full rewrite: 4 collapsible sections, expanded 38-color palette with hex dot swatches, count badges in headers |

No new components needed -- uses existing `Collapsible` from Radix, existing `Chip`, `SettingsGroup`, `SettingsRow`, `Select`, `Switch`.

