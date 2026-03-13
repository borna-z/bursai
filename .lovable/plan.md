

# Redesign /auth to Match Landing Page Design

## Current State
The auth page uses a **dark theme** (`dark-landing` class, `#030305` background, white text, glassmorphic card) — completely mismatched with the landing page's warm editorial aesthetic.

## Landing Page Design Language
- **Palette**: `--bg: #F5F0E8` (warm cream), `--surf: #EDE8DF`, `--ink: #1C1917` (near-black), `--muted: #6B6560`, `--border: #DDD8CF`
- **Typography**: Playfair Display (serif, headlines), DM Sans (body)
- **Style**: Editorial, uppercase eyebrows with letter-spacing, thin borders, no rounded cards — rectangular/sharp buttons with border outlines
- **Buttons**: `btn-primary` = solid ink bg, uppercase, wide letter-spacing; `btn-ghost` = underline on hover

## Plan

### Rewrite `src/pages/Auth.tsx` visual layer

Keep all auth logic (signIn, signUp, handleOAuth, handleForgotPassword, PasswordRequirements) intact. Redesign the JSX and styling:

1. **Background**: Replace `dark-landing` + aurora glows with `bg-[#F5F0E8]` warm cream, matching landing `--bg`
2. **Logo**: Switch from `burs-logo-white.png` to `burs-landing-logo.png` (dark version for light bg)
3. **Typography**: 
   - Tagline uses DM Sans, `text-[#6B6560]` (muted), uppercase with letter-spacing
   - Labels use DM Sans, `text-[#6B6560]`
4. **Card container**: Replace glassmorphic dark card with a clean bordered container: `border border-[#DDD8CF] bg-[#EDE8DF]` — no rounded-2xl, use subtle rounding or none
5. **Inputs**: Restyle from dark glass inputs to light: `bg-white/60 border-[#DDD8CF] text-[#1C1917] placeholder:text-[#6B6560]/50` 
6. **Tab switcher**: Match editorial style — uppercase, letter-spaced, with underline indicator instead of pill background
7. **OAuth buttons**: Bordered rectangular style matching `nav-cta` — `border border-[#1C1917] text-[#1C1917]` uppercase, letter-spaced
8. **Primary submit button**: Solid ink style — `bg-[#1C1917] text-[#F5F0E8]` uppercase, letter-spaced, rectangular
9. **Forgot password / Remember me**: Use `text-[#6B6560]` and `text-[rgba(28,25,23,0.35)]` for faint elements
10. **Password requirements**: Adapt check colors from emerald to ink-based indicators
11. **Loading state**: Change spinner bg from dark to `bg-[#F5F0E8]` with ink-colored spinner
12. **Add Google Fonts link** for Playfair Display + DM Sans in `index.html` (or check if already present)

### Files to edit
- `src/pages/Auth.tsx` — full visual redesign
- `index.html` — add Playfair Display + DM Sans font imports if not already present

