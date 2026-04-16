# Travel Capsule Results Redesign — "The Travel Edit"

**Date**: 2026-04-16
**Scope**: Frontend-only visual redesign of TravelResultsView + garment cap fix in TravelStep2
**Goal**: Transform the capsule results from a generic dashboard into an editorial travel feature that feels like a luxury stylist packed for you

## Emotional Direction

"My stylist packed for me" — calm, confident, curated. The AI disappears; it just feels like expert taste. Scandinavian editorial aesthetic: typography-forward, generous whitespace, no boxy dashboard cards.

## Files Changed

| File | Change Type |
|------|------------|
| `src/components/travel/TravelResultsView.tsx` | Major rewrite — hero header, tab bar, outfits tab, action bar |
| `src/components/travel/CapsuleSummary.tsx` | Major rewrite — packing tab redesign |
| `src/components/travel/TravelStep2.tsx` | Targeted fix — remove `.slice(0, 32)` garment cap |
| `src/index.css` | Add `.scroll-fade-bottom` utility class |
| `src/i18n/locales/en.ts` | Append new keys (if any needed) |
| `src/i18n/locales/sv.ts` | Append new keys (if any needed) |

## Files NOT Changed

| File | Reason |
|------|--------|
| `src/components/travel/useTravelCapsule.ts` | No data flow changes |
| `src/components/travel/CapsuleOutfitCard.tsx` | Internal rendering stays — only outer wrapper changes |
| `src/components/chat/OutfitSuggestionCard.tsx` | Untouched |
| `src/components/travel/GarmentSelectionPanel.tsx` | Already correct (per-category max, 150 ceiling) |
| Any edge function | Purely frontend work |
| Any DB schema | No migrations |

---

## Fix 1: Editorial Hero Header

**Replaces**: The `<Card className="space-y-5 p-5">` wrapper containing nav buttons, PageIntro, 3 stat grid cards, weather card, and day forecast grid.

### Navigation row
- Back arrow (left) + Edit pencil (right)
- Both use `variant="quiet"` (ghost buttons, no outline)
- Same `onClick` behavior — `navigate(-1)` and `setResult(null)`

### Destination title
- `font-display italic text-3xl tracking-tight text-foreground` (Playfair Display)
- Vibe chip sits below the title as a small accent pill: `eyebrow-chip !bg-secondary/70 capitalize`
- No `PageIntro` component — replaced with direct typography

### Date + weather inline
- Single line below vibe chip
- Format: `Jun 12–18 · 22–26°C · Partly cloudy`
- Includes `WeatherMiniIcon` inline before the condition text
- `text-sm text-muted-foreground`
- If no weather data, just show dates: `Jun 12–18`

### Day forecast strip
- Horizontal scrollable row: `flex gap-2 overflow-x-auto pb-2`
- Each day pill: compact, no border — `rounded-xl bg-secondary/40 px-3 py-2 text-center`
- Content per pill: day abbreviation (`Mon`) in `label-editorial !text-[0.58rem]`, weather icon, high temp
- Hide scrollbar: `-webkit-overflow-scrolling: touch` + scrollbar-hide utility
- Only renders if `tripDayForecasts.length > 0`

### Stats as typographic line
- Single line: `{totalItems} pieces · {result.outfits.length} looks · {packedCount}/{totalItems} packed`
- Styled as `text-sm text-muted-foreground`
- No boxes, no grid, no cards

### Divider
- `border-t border-border/40 mt-5 pt-5` separates hero from tab section

### Partial results banner
- Stays below the hero divider, above the tabs
- Changes from `rounded-[1.35rem] border border-amber-500/30 bg-amber-500/5` to a left-border accent: `border-l-2 border-amber-500/40 pl-3 py-2`
- Same i18n text logic, same `coverage_gaps` computation

---

## Fix 2: Editorial Tab Bar

**Replaces**: The `<div className="flex rounded-full border p-1.5">` pill toggle.

### Structure
- Two text buttons side by side with generous horizontal gap
- No wrapper border, no pill background, no `rounded-full`
- Layout: `flex gap-8` (generous spacing)

### Active state
- `text-foreground font-medium border-b-2 border-accent pb-1`

### Inactive state
- `text-muted-foreground hover:text-foreground pb-1 border-b-2 border-transparent`

### Typography
- `text-sm uppercase tracking-[0.12em]` — editorial label style
- Same `hapticLight()` on tap

### Animation
- `AnimatePresence mode="wait"` stays on tab content switching
- Same `motion.div` enter/exit transitions

---

## Fix 3: Outfits Tab Redesign

**Replaces**: Day-grouped `<Card>` wrappers containing `CapsuleOutfitCard` stacks.

### Day sections
- No `<Card>` wrapper per day
- Each day is separated by whitespace (`mt-8` between days)
- Day header: `Day {n}` in `font-display italic text-xl` (Playfair Display)
- Below day header: date + weather inline — `Mon Jun 12 · 24°C ☀️` in `text-sm text-muted-foreground`
- Day header + meta sits in a `mb-3` block

### Outfit cards within a day
- `CapsuleOutfitCard` renders as before (delegates to `OutfitSuggestionCard`)
- No additional border/card wrapper around each outfit
- If multiple outfits in one day: separated by `border-t border-border/20 pt-3 mt-3`
- The `outfit.note` (AI stylist comment) is already rendered by `OutfitSuggestionCard` — no change needed

### Animation
- Keep existing Framer Motion stagger (`STAGGER_DELAY` per outfit)
- Keep the `motion.div` wrapper in `CapsuleOutfitCard`

### Date computation for day headers
- Use `dateRange.from` + `addDays(dateRange.from, day - 1)` to get actual date
- Use `format(date, 'EEE MMM d', { locale: dateLocale })` for display
- Weather per day: `tripDayForecasts[day - 1]` (index maps to day number)

---

## Fix 4: Packing Tab Redesign

**Replaces**: `CapsuleSummary.tsx` — progress card, category cards, summary footer, copy button, coverage gaps card, packing tips card.

### Progress indicator
- Thin full-width accent bar at top: `h-1 rounded-full bg-muted/30` with animated accent fill (same Framer Motion animation as current)
- Below bar: `{packedCount} of {totalItems} packed` in `label-editorial` + `text-sm text-muted-foreground` on same line
- `{result.outfits.length} outfits` as an `eyebrow-chip` floating right — same as current

### Category sections
- No `<Card>` wrappers
- Each category separated by `border-t border-border/40 pt-4 mt-4`
- Category header: `label-editorial` with inline meta — `Tops · 4 pieces · used in 8 outfits`
- Keep stagger animation per category (`motion.div` with `STAGGER_DELAY`)

### Garment rows
- No border wrapper per row
- Layout: checkbox + thumbnail + text, same horizontal arrangement
- Checkbox: minimal circle — `h-5 w-5 rounded-full border` (empty) → `bg-accent border-accent` with `Check` icon (checked)
- Change from `rounded-md` (current square-ish) to `rounded-full` (circle)
- Thumbnail: same `h-11 w-11 rounded-[1rem]`
- Title: same truncation + strikethrough on checked
- Outfit count: same `text-[0.72rem]` meta
- Row interaction: `py-2.5` padding, hover/tap state via `hover:bg-secondary/30 rounded-xl transition-colors`
- No outer border on the row (currently has `rounded-[1.35rem] border p-3`)

### Packing tips section
- `border-t border-border/40 pt-4 mt-6`
- `label-editorial` header with `LightbulbIcon`
- Bullet points in `text-xs text-muted-foreground` — same content
- No `<Card>` wrapper

### Coverage gaps
- Removed from packing tab — coverage gaps are already shown once in the partial-results banner above the tabs (Fix 1). No need to duplicate inside the packing view.

### Copy packing list button
- `variant="editorial"` full width — stays as-is
- Positioned after tips/gaps, before bottom padding

### Removed
- Summary footer card (`{totalItems} items · creates {n} unique outfits`) — redundant with the progress area

---

## Fix 5: Action Bar Refinement

**Replaces**: Current `action-bar-floating` bar.

### Layout
- Keep floating position with `var(--app-safe-area-bottom)` handling
- Single row: `flex items-center gap-2` — remove `flex-wrap`
- Tighter padding: `p-2` instead of `p-3`
- Same `rounded-[1.6rem]` and `action-bar-floating` backdrop class

### Buttons
- "Add to plan" — primary CTA, `flex-1`, no change
- "Start over" — change from `<Button variant="outline">` to a `<button>` styled as ghost text (not a `<Link>`): `text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground px-3`. Still calls `setResult(null); setAddedToCalendar(false)`
- Share icon — stays as `variant="outline" size="icon"`
- `AILoadingCard` and "View in Planner" states — no change

---

## Fix 6: Garment Cap in TravelStep2

**File**: `src/components/travel/TravelStep2.tsx`, line 268

### Bug
The must-haves garment picker renders `(allGarments ?? []).slice(0, 32)` — hard-capping visible garments to 32. Users with larger wardrobes cannot see or select garments beyond the 32nd.

### Fix
- Remove `.slice(0, 32)` — render all garments
- Wrap the grid in a scrollable container: `max-h-[320px] overflow-y-auto`
- Add a bottom fade gradient mask when content overflows (add to `src/index.css`):
  ```css
  .scroll-fade-bottom {
    mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
  }
  ```
- Apply the fade class conditionally when garment count > 16 (what fits in ~4 rows of 4-col grid)
- The 4-column grid layout stays unchanged

---

## Design Tokens Used

All from existing BURS design system — no new tokens:

| Token | Usage |
|-------|-------|
| `font-display italic` | Destination title, day headers (Playfair Display) |
| `label-editorial` | Section labels, stats |
| `eyebrow-chip` | Vibe chip, outfit count |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text, meta |
| `border-border/40` | Section dividers |
| `bg-secondary/40` | Forecast pill backgrounds |
| `bg-accent` | Progress bar fill, checkmark fill |
| `border-accent` | Active tab underline, checked state |
| `EASE_CURVE` | All Framer Motion transitions |
| `STAGGER_DELAY` | Category/outfit stagger animation |
| `hapticLight()` | All tap interactions |

## Testing

- Existing `GarmentSelectionPanel` tests — should still pass (no changes to that component)
- Manual verification: garment picker in Step2 shows all garments with scroll
- Manual verification: results page renders correctly with 0 outfits (fallback), 1 outfit, and multi-day trips
- Visual regression: check both light and dark mode
- Safe-area handling: action bar uses `var(--app-safe-area-bottom)` (already correct)

## Out of Scope

- No edge function changes
- No DB migrations
- No changes to `useTravelCapsule.ts` data flow
- No changes to `OutfitSuggestionCard` internals
- No changes to `GarmentSelectionPanel` slider logic
- No new npm packages
