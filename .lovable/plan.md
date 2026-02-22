

# Fix: BURS Live Scan name + Logo size

Two quick fixes:

---

## 1. Rename "Drape Live Scan" to "BURS Live Scan"

In `src/pages/Wardrobe.tsx` line 318, change:
```
Drape Live Scan
```
to:
```
BURS Live Scan
```

## 2. Increase logo size

In `src/components/ui/BursMonogram.tsx`, increase the default size from `32` to `40`:
```tsx
export function BursMonogram({ size = 40, className }: BursMonogramProps)
```

And in `src/components/ui/DrapeLogo.tsx`, bump the sizeMap values:
- sm: 24 -> 28
- md: 32 -> 40
- lg: 40 -> 48
- xl: 56 -> 64

---

## Technical Details

### Files to modify:
1. `src/pages/Wardrobe.tsx` -- line 318: "Drape Live Scan" -> "BURS Live Scan"
2. `src/components/ui/BursMonogram.tsx` -- default size 32 -> 40
3. `src/components/ui/DrapeLogo.tsx` -- bump all sizeMap values

No new files, no dependencies, no database changes.

