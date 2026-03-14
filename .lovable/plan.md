

# 25-Step Design Alignment: Landing → App (Light Mode Only)

The landing page (`landing.html`) uses a warm editorial aesthetic: `#F5F0E8` background, `#EDE8DF` surfaces, `#DDD8CF` borders, `#1C1917` ink, `#6B6560` muted text, Playfair Display headings + DM Sans body, zero border-radius (square edges), and 1px solid borders. The Auth page already matches this perfectly. The in-app light mode uses Tailwind CSS tokens (`--background: 36 22% 95%` ≈ `#F2EEE8`, cards = pure white `#FFF`, rounded-2xl corners, Inter/Sora fonts). The gap is subtle but real: the light mode tokens are close but not exact, corners are rounded vs. square, and fonts differ.

**Scope**: Adjust light-mode CSS tokens + key component styles to match the landing's editorial warmth. Dark mode stays untouched.

---

## Phase 1: Core Light-Mode Token Alignment (Steps 1-4)

### Step 1 — Shift light-mode `--background` to exact landing value
Change `:root --background` from `36 22% 95%` (#F2EEE8) to `36 25% 95%` (#F5F0E8 exact). This is the single most impactful change — every `bg-background` surface shifts to match.

### Step 2 — Shift light-mode `--card` to landing surface
Change `--card` from `0 0% 100%` (pure white) to `36 20% 93%` (#EDE8DF). Cards, popovers, and sheets now match the landing's `--surf` tone.

### Step 3 — Shift light-mode `--border` to landing border
Change `--border` from `36 14% 88%` to `36 15% 86%` (#DDD8CF exact). Inputs follow automatically via `--input`.

### Step 4 — Shift light-mode `--muted-foreground` to landing muted
Change `--muted-foreground` from `0 0% 42%` to `20 5% 40%` (#6B6560 exact). Captions, sublabels, and secondary text warm up.

---

## Phase 2: Typography Alignment (Steps 5-7)

### Step 5 — Add Playfair Display + DM Sans to font imports
Add Google Fonts `<link>` for Playfair Display and DM Sans in `index.html` (landing.html already loads them separately).

### Step 6 — Map heading font to Playfair Display for light mode
In `index.css`, wrap the heading `font-family` rules in a `:root:not(.dark)` selector so light-mode headings use `'Playfair Display', serif` while dark mode keeps Sora.

### Step 7 — Map body font to DM Sans for light mode
Similarly, set body `font-family` to `'DM Sans', sans-serif` for light mode only. Dark mode retains Inter.

---

## Phase 3: Shape & Surface Alignment (Steps 8-10)

### Step 8 — Reduce light-mode border-radius
Add a CSS rule `:root:not(.dark) { --radius: 0px; }` so buttons, cards, inputs lose their rounded-2xl in light mode, matching the landing's square aesthetic. Dark mode keeps `0.75rem`.

### Step 9 — Remove card shadows in light mode
Add `:root:not(.dark) .card-clean { box-shadow: none; }` — landing uses only 1px borders, no drop shadows.

### Step 10 — Adjust SettingsGroup card styling
The `SettingsGroup` uses `rounded-2xl bg-card/50`. Add a light-mode override: square corners, full `bg-card` opacity, 1px border.

---

## Phase 4: Reset Password Page (Steps 11-12)

### Step 11 — Restyle ResetPassword for light mode
Currently uses dark-landing noir aesthetic. Wrap content in a theme-aware container: light mode gets `#F5F0E8` background, `#1C1917` ink, `#EDE8DF` card surface with 1px `#DDD8CF` borders (matching Auth page exactly).

### Step 12 — Switch ResetPassword logo
Use `burs-logo-256-2.png` (dark logo) in light mode instead of `burs-logo-white.png`. Keep white logo for dark mode.

---

## Phase 5: Pricing Page (Steps 13-15)

### Step 13 — Restyle Pricing header
Replace the generic `bg-background border-b` header with the landing's editorial style: 1px solid `#DDD8CF` border, DM Sans font, uppercase letter-spaced back button.

### Step 14 — Restyle Pricing card
Replace amber gradient card with editorial pricing: Playfair Display for price amount, DM Sans for features, `#EDE8DF` card background, `#1C1917` ink CTA button with hover inversion.

### Step 15 — Restyle FAQ section
Replace shadcn Card-based FAQ with landing-style border-bottom accordion rows, Playfair heading, DM Sans body.

---

## Phase 6: Billing & NotFound Pages (Steps 16-18)

### Step 16 — Restyle BillingSuccess
Light mode: `#F5F0E8` background, editorial card with ink checkmark instead of amber gradient circle, square corners, Playfair heading.

### Step 17 — Restyle BillingCancel
Same treatment as BillingSuccess — warm editorial card, square corners, ink colors.

### Step 18 — Restyle NotFound
Light mode: warm background, Playfair Display "404" heading, DM Sans body, ink-colored "Return to Home" link with underline-on-hover.

---

## Phase 7: Component-Level Light Mode Polish (Steps 19-22)

### Step 19 — PageHeader light-mode refinement
In light mode: use 1px solid `var(--border)` instead of `border-border/20`, reduce backdrop blur (or remove — landing nav has no blur), use DM Sans uppercase letter-spaced titles.

### Step 20 — BottomNav light-mode refinement
In light mode: solid `bg-background` (no transparency), 1px top border, remove backdrop-blur/saturate. Dark mode stays glassy.

### Step 21 — PaywallModal light-mode refinement
Square corners on modal card, editorial typography, ink-colored CTA button instead of gradient.

### Step 22 — Input fields global light-mode style
Add light-mode overrides for all `<input>` and `<textarea>`: `bg-white/60`, 1px `#DDD8CF` border, square corners, DM Sans `text-[15px]`, matching Auth page's `inputClass`.

---

## Phase 8: Marketing Pages & Onboarding (Steps 23-25)

### Step 23 — Contact page border-radius fix
Currently uses `rounded-xl` on inputs and buttons — change to square (or inherit from `--radius: 0`). Already uses correct colors.

### Step 24 — Onboarding step progress bar
Light mode: change progress bar from `bg-white/[0.06]` + `bg-white/40` to `bg-[#DDD8CF]` + `bg-[#1C1917]` fill. Dark mode keeps current.

### Step 25 — Privacy/Terms header link fix
Both pages link "Back" to `/welcome` which doesn't exist. Fix to `/` (home/landing). Also ensure font imports aren't duplicated per-page now that they're in `index.html`.

---

## Design Rules

- All changes scoped to `:root:not(.dark)` or `light:` Tailwind prefix — dark mode is **completely untouched**
- Landing.html is static and separate — no changes to it
- Auth page already matches — no changes needed
- Contact, Privacy, Terms already use inline landing colors — only shape (border-radius) needs fixing

