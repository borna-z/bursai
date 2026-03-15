

# Premium Wardrobe Screen Refinement

## Current Issues

- **Title area**: `text-2xl font-bold` is fine but the view toggle and select button feel like utility afterthoughts — small, unstyled tap targets
- **Segmented control**: Works but `text-[13px]` is small; the `surface-inset` container blends into the page
- **Search bar**: Functional but generic — `surface-inset` with low-contrast placeholder text feels flat
- **Smart filter chips**: Use `size="lg"` (44px tall) which is chunky; the count badge `opacity-60` is weak; unselected chips use `bg-secondary/50` which is generic
- **Garment grid**: `gap-1.5` is tight; `rounded-2xl` on tiles is very round; the wear-count badge (`bg-background/70 backdrop-blur-sm`) is decent but small and faint
- **FAB**: Good shadow treatment but the expanded menu items have `shadow-xl` which is heavy
- **Grid card**: No border or surface treatment — just raw `bg-muted` on the image container

## Plan

### 1. Wardrobe.tsx — Title, Controls, Search, Chips, Grid

**Title row** (line 524-540):
- Add garment count as `label-editorial` below the title (e.g., "48 PIECES") to ground the screen
- View toggle: increase to `w-10 h-10` with `surface-inset rounded-xl` for more intentional feel
- Select button: slightly larger text `text-[13px]` → `text-sm`

**Segmented control** (line 543-558):
- Increase font from `text-[13px]` to `text-sm` 
- Add `border border-border/10` on the container for subtle definition

**Search bar** (line 564-593):
- Increase search icon size subtly and use `text-muted-foreground/50` instead of `/40`
- Add `shadow-none focus-within:ring-1 focus-within:ring-border/20` for subtle focus state

**Smart filter chips** (line 596-617):
- Switch from `size="lg"` to `size="md"` — 44px min-height is too chunky for this context
- Add `border border-border/20` to unselected chip variant so they feel more defined
- Make the count badge use `text-[10px] font-medium` with a slight background pill

**Grid** (line 189, 280):
- Increase gap from `gap-1.5` to `gap-[5px]` — slightly more breathing room without breaking density
- Reduce tile corner radius from `rounded-2xl` to `rounded-xl` — more refined, less bubbly

**Grid card badges** (line 117):
- Increase badge font to `text-[11px]` and add `border border-white/10` for more presence

**FAB menu** (line 349):
- Reduce shadow from `shadow-xl` to `shadow-lg` on menu items
- Add `border-border/20` instead of `/30`

### 2. Chip.tsx — Refine default variant

- Default variant: add `border border-border/20` for definition when unselected
- Selected variant: keep `bg-accent` but add slightly stronger shadow `shadow-[0_1px_3px_rgba(0,0,0,0.08)]`
- Reduce `lg` size min-height from `44px` to `40px`

### 3. WardrobeOutfitsTab.tsx — Quick check for consistency

- Ensure outfit mosaic tiles use same `rounded-xl` and gap as garment grid

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Wardrobe.tsx` | Title count label, view toggle styling, segmented control border, search focus state, chip sizing, grid gap/radius, badge polish, FAB shadow |
| `src/components/ui/chip.tsx` | Add border to default variant, refine selected shadow, adjust lg size |

## What Does NOT Change

- Layout structure, section order, tab system
- Search/filter logic, smart filter behavior
- FAB position and functionality
- Bottom navigation
- Data fetching, routing, state management

