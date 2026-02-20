

## Make Logo Black and Hero Much Bigger on Landing Page

### 1. Make the logo black everywhere on the landing page

Currently the `BursMonogram` component defaults to black (`brightness-0`), but the landing page overrides this with `!brightness-100` to make it white. I'll remove that override so the logo displays in black.

**Three places in `src/pages/Landing.tsx`:**
- **Header** (line 55): Remove `!brightness-100` from the `BursMonogram` className
- **Hero** (line 97): Remove `!brightness-100` from the `BursMonogram` className
- **Final CTA** (line 272): Remove `!brightness-100` from the `BursMonogram` className

### 2. Make the hero logo much bigger

Currently the hero logo is `size={120}`. I'll increase it to `size={220}` so it becomes a dominant visual element in the hero section.

**`src/pages/Landing.tsx`** (line 97): Change `size={120}` to `size={220}`

### Summary of changes

Only one file changes: `src/pages/Landing.tsx` -- four small edits to make the logo black and the hero version significantly larger.

