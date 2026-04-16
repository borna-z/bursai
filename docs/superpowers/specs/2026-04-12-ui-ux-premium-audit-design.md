# BURS UI/UX Premium Audit — Design Spec

**Date:** 2026-04-12
**Goal:** Elevate BURS from functional to premium, Vogue-like editorial quality with addictive iOS-native UX.
**Approach:** Phased rollout — 4 phases, each producing a shippable PR.
**Implementation skill:** `frontend-design:frontend-design`

---

## Constraints

- No emojis anywhere in the project — use SVG icons exclusively
- iOS-first design: SF Pro system font stack, hairline borders, iOS interaction patterns
- All colors via CSS custom properties — no hardcoded values
- All charts/accents adapt to user's chosen accent color (12 presets in ThemeContext)
- Light and dark mode must both work correctly for every change
- Insights page freeze is lifted for this audit — full redesign permitted
- Median-specific files remain untouched (`useMedianCamera.ts`, `useMedianStatusBar.ts`, `median.ts`)

---

## Phase 1: Systemic Fixes

### 1.1 Safe Areas & Headers

**Problem:** All page headers collide with iPhone Dynamic Island and status bar. Content sits too close to screen edges.

**Fix:**
- Apply `env(safe-area-inset-top)` + 12px breathing room to all page headers
- Set 20px minimum horizontal padding on all page content
- Create a shared `PageHeader` component that encapsulates safe area logic so it's never forgotten
- Bottom safe area: verify `--app-bottom-clearance` works correctly with the new compact nav
- Every page in the app must use the standardized header — no page-specific top padding hacks

**Files affected:** `AppLayout.tsx`, all files in `src/pages/`, new `PageHeader` component.

### 1.2 Accent Color Bug

**Problem:** User-chosen accent color doesn't apply consistently across the app. Some components use hardcoded colors instead of `var(--accent)` / `var(--primary)`.

**Fix:**
- Audit every component for hardcoded color values (hex, hsl, rgb) that should reference CSS custom properties
- Fix the contrast auto-calculation in `ThemeContext.tsx` — `--accent-foreground` must produce readable text on the accent color in both light and dark mode
- Verify the localStorage (`burs-accent`) to database (`profiles.preferences`) sync flow, especially on first login, theme switch, and page refresh
- Test all 12 accent colors (indigo, petrol, forest, sage, navy, slate, burgundy, rose, terracotta, amber, plum, charcoal) in both light and dark mode across Home, Nav, Insights, Settings, cards, and modals

### 1.3 Light Mode Contrast

**Problem:** Numbers and text disappear in light mode, especially on Insights. Wrong opacity values and missing foreground color tokens.

**Fix:**
- All text must use `var(--foreground)` or semantic tokens, not hardcoded `rgba()`
- Card surfaces in light mode get opaque white backgrounds (`rgba(255,255,255,0.7)` minimum) so content is always readable against the cream background
- Audit opacity hierarchy: primary text full opacity, secondary at 0.4, tertiary at 0.3 — never below 0.3 for readable content

### 1.4 Dark Mode Polish

**Problem:** Settings page icons/logos look dated (2010-era). Heavy borders, boxy icon containers, cold tones.

**Fix:**
- Replace all boxy icon container patterns with inline SVG icons at 50% opacity
- Settings page: iOS-style grouped list with hairline (0.5px) separators, no individual card borders
- Audit all pages for heavy borders (> 0.5px), cold/blue tones, or non-warm charcoal backgrounds
- Dark mode surfaces: `rgba(255,255,255,0.03)` background, `0.5px solid rgba(255,255,255,0.06)` borders — consistent everywhere

---

## Phase 2: Navigation Overhaul

### 2.1 Bottom Nav Redesign

**Current:** 4 nav items + centered add button. Bar is too tall. Icons feel Android-like.

**New layout:** `Home | Wardrobe | (+) | Plan | Insights`

**Specifications:**
- **Height:** ~30% shorter than current. Padding: `6px` top, `6px + env(safe-area-inset-bottom)` bottom
- **Separator:** 0.5px hairline top border (`rgba(255,255,255,0.06)` dark / `rgba(0,0,0,0.06)` light)
- **Background:** `rgba(28,25,23,0.88)` with `backdrop-filter: blur(24px)` (dark mode). Warm cream equivalent for light mode.
- **Font:** `-apple-system, SF Pro Text, 'DM Sans', sans-serif` at 10px, letter-spacing -0.1px
- **Active state:** Full opacity, filled icon. No pill background.
- **Inactive state:** 42% opacity, stroked icon
- **Spacing:** All 5 items use `flex: 1` for equal distribution

**Icons (all 1.5px stroke, rounded caps/joins, iOS-native style):**
- Home: Filled house shape (active), stroked (inactive)
- Wardrobe: Folded stack — three rounded rectangles stacked vertically
- (+): Accent-colored rounded rectangle (44x36px, 12px radius), white + icon inside. Uses user's accent color as gradient.
- Plan: Calendar with rounded corners, day dots
- Insights: Line chart trending upward

### 2.2 Add Button Quick Actions

**Trigger:** Tap the center (+) button.

**Behavior:** Bottom sheet slides up with backdrop blur. Three options:
1. **Add Garment** — navigates to `/wardrobe/add`
2. **BURS Live Scan** — navigates to `/wardrobe/scan`
3. **Bulk Add** — navigates to bulk add flow (existing or new route TBD during implementation — reuse existing bulk add if it exists, otherwise create as part of Phase 2)

**Sheet styling:** Same minimal aesthetic — hairline borders, SVG icons, iOS grouped list pattern. Haptic feedback on tap.

---

## Phase 3: Home as Hub

### 3.1 Home Page Restructure

**Current:** Header, quick shortcuts grid, Today's Look card, context line.

**New layout (top to bottom):**

1. **Header area:**
   - Date in uppercase, wide letter-spacing (1.5px), 10px, 30% opacity
   - Greeting in Playfair Display italic, 24px
   - Right side: notification icon + profile avatar (accent gradient circle with initial)

2. **Weather pill:**
   - Inline-flex, rounded full, hairline border, subtle background
   - Weather icon (SVG, not emoji) + temperature + city

3. **Today's Look hero card:**
   - Full-width, 18px radius, gradient background hint using accent color at low opacity
   - Garment thumbnail previews inside
   - "TODAY'S LOOK" uppercase label + outfit description

4. **"Your Stylist" section:**
   - Section header: uppercase, 1.8px letter-spacing, 30% opacity — Vogue magazine style
   - 2x2 grid of cards: Style Chat, Generate Outfit, Style Me, Mood Outfit
   - Each card: SVG icon (no emoji), title in DM Sans 500, subtitle at 35% opacity
   - Cards: `rgba(255,255,255,0.03)` bg, `0.5px solid rgba(255,255,255,0.06)` border, 16px radius

5. **"Discover" section:**
   - Same section header style
   - 2x2 grid: Travel Capsule, Discover, Wardrobe Gaps, Settings
   - Same card style as above

**Removed from Home:** The 5-item secondary shortcut grid is replaced by the two section grids. All features that were in the shortcut grid are now in the hub sections.

---

## Phase 4: Insights Dashboard Redesign

### 4.1 Page Header

- "INSIGHTS" uppercase label + "Your Style Story" in Playfair italic
- Uses shared `PageHeader` component with proper safe areas

### 4.2 Hero Stats

- 3-column grid: Garments, Outfits, Wears
- Large number (26px, DM Sans 600), small uppercase label below (9px, 30% opacity)
- Minimal card style

### 4.3 Wear Frequency Bar Chart

- 7 bars for days of the week (M T W T F S S)
- Accent color gradient — higher bars get more opacity
- Rounded top corners (6px), 2px bottom corners
- Day labels at 8px, 30% opacity
- "Last 30 days" label in top-right corner at 30% opacity

### 4.4 Color Palette

- Horizontal stacked bar showing wardrobe color distribution
- 28px height, 8px radius
- Legend below with color dots (8px circles) and percentage labels
- Actual garment colors from user's wardrobe data

### 4.5 Category Donut + Cost Per Wear (side by side)

**Category donut:**
- SVG donut chart with accent color at varying opacities per segment
- Center: total item count + "items" label

**Cost per wear:**
- Three progress bars: Best value (green), Average (accent), Worst (red)
- Dollar amounts right-aligned
- 4px bar height, rounded

### 4.6 Wardrobe Health Radar

- 6-axis radar chart: Variety, Color, Usage, Season, Value, Fit
- Three concentric grid polygons at decreasing opacity
- Data polygon: accent color fill at 12% opacity, accent stroke at 50%
- Labels at 8px, 35% opacity
- Centered in card

### 4.7 Chart Implementation

- All charts are pure SVG — no chart library dependency needed
- All chart colors use `var(--accent)` at varying opacities so they adapt to user's chosen accent
- Charts must be readable in both light and dark mode
- Consider adding subtle Framer Motion fade-in animations when charts enter viewport

---

## Design System Updates

### iOS-Native Principles (applied globally)

- **Font stack:** `-apple-system, SF Pro Text, 'DM Sans', sans-serif` for UI elements
- **Playfair Display italic** reserved for hero/greeting text only
- **Borders:** 0.5px maximum. Never heavier.
- **Icon style:** 1.2-1.5px stroke, rounded caps/joins, no containers. Filled for active state.
- **Section headers:** Uppercase, letter-spacing 1.5-1.8px, opacity 0.3, 10-11px
- **Card style:** `rgba(255,255,255,0.03)` bg (dark) / `rgba(255,255,255,0.7)` bg (light), `0.5px solid rgba(255,255,255,0.06)` border (dark) / `0.5px solid rgba(0,0,0,0.06)` (light), 14-18px radius
- **Grouped lists (Settings etc):** Single container, hairline internal separators, chevron indicators at 20% opacity
- **Haptic feedback:** `hapticLight()` on every interactive element

### No-Emoji Rule

Every instance of emoji in the codebase UI must be replaced with an equivalent SVG icon matching the iOS-native icon style (1.5px stroke, rounded). This includes Home page cards, navigation, toasts, modals, and any other UI surface.
