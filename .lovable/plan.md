

# Fix: Accent Colors + Button Animation on Home Page

## Problem 1: Accent Colors Look Inconsistent in Dark Mode
The selected state on occasion buttons, sub-option chips, and style chips uses `border-accent bg-accent/5 text-accent` without dark-mode variants. Meanwhile, the unselected state has explicit `dark:` overrides. This mismatch makes selected buttons look "off" in dark mode -- the accent background opacity doesn't pop enough against the near-black surface.

**Fix**: Add explicit dark-mode selected styles that use the accent color with better visibility:
- Selected: `dark:border-accent dark:bg-accent/10 dark:text-accent` (ensuring accent references work correctly in dark)
- Also bump `bg-accent/5` to `bg-accent/10` for light mode since 5% is nearly invisible

**Files**: `src/pages/Home.tsx` (lines 349, 377-378, 401-402)

## Problem 2: Buttons "Bounce" Weirdly on Tap
The `motion.button` elements use `whileTap={{ scale: 0.94 }}` with a spring transition (`stiffness: 500, damping: 30, mass: 0.5`). When released, the spring causes the button to visibly oscillate/bounce back to scale(1) over ~200ms. This looks unintentional and "strange".

**Fix**: Replace the spring-based `whileTap` with a simpler, instant transition:
- Change transition to `{ type: 'tween', duration: 0.1 }` for a clean, instant press-and-release
- Or increase damping to 40+ so the spring doesn't overshoot

I recommend `type: 'tween', duration: 0.1` for a crisp, premium feel without any bounce.

**Files**: `src/pages/Home.tsx` (lines 344-345, 372-373, 396-397)

## Summary of Changes

### `src/pages/Home.tsx`
1. **Occasion buttons** (line 344-351): Change `whileTap` transition to tween, update selected class
2. **Sub-option chips** (line 372-379): Same tween transition, update selected class  
3. **Style chips** (line 396-403): Same tween transition, update selected class

All three button groups get:
- `transition={{ type: 'tween', duration: 0.1 }}` instead of the spring
- Selected: `border-accent bg-accent/10 text-accent` (works in both modes since accent is a CSS variable)
- Unselected dark: stays as `dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70`

Total: **1 file**, 6 small edits (3 transitions + 3 selected states)
