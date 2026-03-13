

## Align LiveScan UI with BURS Design Theme

### Current issues
The LiveScan page uses hardcoded emerald greens, raw white text, and generic camera-app styling that clashes with the BURS premium Scandinavian aesthetic. It feels like a stock camera app rather than part of BURS.

### Changes

**`src/pages/LiveScan.tsx`** — Retheme all UI elements:

1. **Color system** — Replace all `emerald-*` references with the app's accent color (`hsl(var(--accent))`). Use `bg-accent/20`, `text-accent` patterns instead of hardcoded greens. This ensures the scan UI respects the user's chosen accent color.

2. **Top bar** — Use `bg-background/70 backdrop-blur-xl` (matching BottomNav glass style) instead of `bg-black/30`. Text uses `text-foreground` instead of `text-white`.

3. **Shutter area** — Same glass treatment `bg-background/70 backdrop-blur-xl` instead of `bg-black/30`. Border color uses `border-foreground` instead of hardcoded white.

4. **Result overlay** — Use `bg-background/90 backdrop-blur-xl` instead of `bg-black/60`. Text uses `text-foreground` and `text-muted-foreground` instead of `text-white` and `text-white/60`. Image gets `rounded-2xl` (already has it) with a subtle border.

5. **Buttons** — Accept button uses `bg-accent hover:bg-accent/90 text-accent-foreground` instead of emerald. Retake button uses `border-border text-foreground` instead of `border-white/20 text-white`.

6. **Accepted overlay** — Checkmark circle uses `bg-accent/20` with `text-accent` icon instead of emerald.

7. **Scan counter pill** — Uses `bg-background/60` with `text-accent` check icon.

8. **ScanOverlay pulse** — Ring uses `border-accent/30` instead of `border-emerald-400/30`. Label pill uses `bg-background/60 text-foreground`.

9. **Reticle** — Stable state uses `border-accent/60` with accent glow shadow instead of emerald.

10. **ScanGuidance** — Ready state uses `bg-accent/20 text-accent` instead of emerald.

11. **AutoProgressRing** — Stroke colors use CSS variable via inline style referencing the accent color, or use a fixed indigo that matches the default accent.

12. **Camera error state** — Text uses `text-muted-foreground`, icon uses `text-muted-foreground/50`, button uses standard outline variant.

### Files to edit
1. `src/pages/LiveScan.tsx` — Full retheme to use design system tokens

