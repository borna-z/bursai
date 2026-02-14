

# Drape Design System Overhaul

A comprehensive visual refresh to establish a premium Scandinavian minimalist identity for Drape.

---

## 1. Typography: Inter + Sora

Load **Inter** (body) and **Sora** (headings) via Google Fonts in `index.html`. Configure Tailwind's `fontFamily` to use `Sora` for headings and `Inter` as the default sans-serif body font. Update the base layer heading styles in `index.css` to apply the heading font.

## 2. Color Palette Overhaul

Replace the current warm slate-blue/teal palette with the new Drape identity in `src/index.css`:

**Light mode:**
- Background: warm off-white (`#F8F7F4` approx `42 30% 97%`)
- Cards: pure white with visible 1px border, minimal shadow
- Primary (Petrol): `#0D5C63` -- used sparingly for active states, selected chips, primary buttons
- Muted tones: warm grays for text hierarchy
- Ring/focus: petrol accent

**Dark mode:**
- Background: deep warm charcoal
- Cards: slightly lighter surface
- Primary: lighter petrol for contrast

Update `--primary`, `--accent`, `--border`, `--card`, `--background`, `--muted` tokens in both `:root` and `.dark`.

## 3. Card Styling

Update the `Card` component to use a crisp 1px border with near-zero shadow:

```
rounded-xl border border-border/80 bg-card text-card-foreground shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]
```

This gives the "floating paper" Scandinavian look without heavy drop shadows.

## 4. Button Refinements

Update `buttonVariants` in `button.tsx`:
- Default: petrol background, white text, rounded-lg, `active:scale-[0.97]` built-in press
- Outline: 1px border, transparent bg, petrol text on hover
- Ensure minimum `h-11` on mobile for 44px touch targets on `default` and `lg` sizes

## 5. Chip Refinements

Update `chipVariants` in `chip.tsx`:
- Selected state uses petrol accent instead of generic primary fill
- Add `active:scale-[0.96]` micro-interaction
- Minimum touch target: `min-h-[44px]` on `lg` size

## 6. Signature "Drape" Transition

Add a new spring-like keyframe animation in `tailwind.config.ts`:

```
"drape-in": {
  "0%": { opacity: "0", transform: "translateY(12px) scale(0.97)" },
  "60%": { opacity: "1", transform: "translateY(-2px) scale(1.005)" },
  "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
},
"drape-out": {
  "0%": { opacity: "1", transform: "translateY(0)" },
  "100%": { opacity: "0", transform: "translateY(8px) scale(0.97)" }
}
```

With animation utilities:
- `animate-drape-in`: `drape-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`
- `animate-drape-out`: `drape-out 0.25s ease-in`

Apply `animate-drape-in` to `OutfitSlotCard` when swapping garments, and as the default card entrance on outfit detail/generate pages.

## 7. Skeleton Refinements

Update `skeleton.tsx` to use the shimmer gradient instead of plain pulse:

```
bg-muted skeleton-shimmer rounded-lg
```

This gives a calmer, more polished loading state.

## 8. Micro-interactions in index.css

- Consolidate `active:scale-[0.97]` as a utility class `.press` for consistent press feedback
- Add `.lift` hover utility: `transition-shadow hover:shadow-md` for cards that respond to touch/hover
- Ensure toast styles remain calm (already using Sonner, no changes needed beyond color token updates)

## 9. Bottom Nav Polish

Update `BottomNav.tsx`:
- Active indicator uses petrol accent pill
- Slightly larger icon area for comfortable touch targets
- Active state: filled icon variant via `strokeWidth` change (already in place, just color update)

## 10. Page Simplification Principle

No structural page changes in this pass -- this is a design token + component skin update. The "max 2 primary actions per screen" rule is already mostly followed. Document it as a guideline for future work.

---

## Files Modified

| File | Change |
|------|--------|
| `index.html` | Add Inter + Sora font imports |
| `tailwind.config.ts` | Add `fontFamily`, drape keyframes/animations |
| `src/index.css` | New color tokens (light + dark), heading font, utility classes |
| `src/components/ui/card.tsx` | Crisp border, minimal shadow |
| `src/components/ui/button.tsx` | Active press scale, touch target sizing |
| `src/components/ui/chip.tsx` | Press micro-interaction, touch target |
| `src/components/ui/skeleton.tsx` | Shimmer instead of pulse |
| `src/components/layout/BottomNav.tsx` | Petrol accent active state |
| `src/components/outfit/OutfitSlotCard.tsx` | Apply `animate-drape-in` |

