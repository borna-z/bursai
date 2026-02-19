
# Visual Audit Report + New Logo Update

## Visual Audit Findings

After reviewing all key screens in both light and dark mode, here is what was found:

### Issues Identified

**1. "Skapa outfit" button — wrong background color (both modes)**
The primary CTA button renders as a flat dark grey instead of true charcoal `#111111` in light mode, and as washed-out grey instead of off-white in dark mode. The issue is that the `bg-primary` token resolves correctly but the button component's hover state (`hover:bg-primary/90`) uses opacity on the HSL variable, which can look muddy when the background is close to the same tone. A small fix to ensure the button stays crisp.

**2. The current logo icon is a placeholder PNG — the new "D" monogram must replace it**
The user has provided the production-ready logo: a refined "D" monogram inside a rounded square container (`Gemini_Generated_Image_pqwabxpqwabxpqwa.png`). This must replace:
- `src/assets/drape-logo.png` (used by `DrapeLogo.tsx` in all app headers)
- `public/favicon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`

**3. Marketing nav logo** — Currently shows the old placeholder icon. Will be fixed automatically once the asset is replaced.

**4. Minor: "Synka nu" button** — Uses `bg-secondary` which renders as a grey that blends into both backgrounds. This is acceptable for a secondary action but could be slightly crisper. No change needed unless requested.

### What looks correct
- Off-white background `#F6F4F1` is rendering correctly in light mode
- Dark mode background `#0A0A0A` is deep and clean
- Border colors (`#E9E6E1`) are subtle and correct
- Typography (Sora headings, Inter body) renders well
- BottomNav active state indicator (`bg-primary/10`) looks correct
- Chips/filter pills in both modes look consistent
- Card surfaces have correct contrast in both modes

---

## Changes to Implement

### 1. Replace logo asset with new "D" monogram
Copy the uploaded image to all asset locations:
- `src/assets/drape-logo.png` — main app logo used by `DrapeLogo.tsx`
- `public/favicon.png` — browser tab favicon
- `public/icons/icon-192.png` — PWA home screen icon (192×192)
- `public/icons/icon-512.png` — PWA splash / store icon (512×512)

### 2. Update `DrapeLogo.tsx` for better icon sizing
The new logo has a rounded square container that looks best with slightly more padding-aware sizing. Update the size map to ensure the icon renders crisply at each breakpoint. Also add `dark:invert` class to handle dark mode — since the new logo is black-on-white, in dark mode it should invert to white-on-black automatically.

```typescript
// src/components/ui/DrapeLogo.tsx
// Add dark:invert to the img className for automatic dark mode support
className="object-contain flex-shrink-0 dark:invert"
```

### 3. Update `index.html` favicon reference
Ensure the `<link rel="icon">` tag points to `favicon.png` and add a correct `sizes` attribute.

---

## Technical Implementation Plan

### Files to modify
| File | Change |
|------|--------|
| `src/assets/drape-logo.png` | Replace with new "D" monogram image |
| `public/favicon.png` | Replace with new "D" monogram image |
| `public/icons/icon-192.png` | Replace with new "D" monogram image |
| `public/icons/icon-512.png` | Replace with new "D" monogram image |
| `src/components/ui/DrapeLogo.tsx` | Add `dark:invert` to img tag for automatic dark mode logo inversion |

### Why `dark:invert` on the logo?
The new logo is a black mark on a near-white background. In dark mode the app background becomes near-black (`#0A0A0A`), so the white canvas of the logo image would create an ugly white rectangle. CSS `dark:invert` flips the image colors — turning the black "D" mark white and the white background transparent-looking against the dark surface. This is the standard technique used by apps like Linear and Vercel for their monochrome logos.

No database changes, no edge function changes, no new dependencies required.
