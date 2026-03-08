

# Today Page Redesign — Premium Command Center

## Current Problems

The Home page has **6 competing sections** (outfit card, swipe suggestions, plan tomorrow, insights banner, adjust day, smart insight) that create a cluttered dashboard feel. No clear hierarchy — everything fights for attention equally. The "Adjust Day" collapsible adds complexity without clear value on the main screen. Cards use nearly-invisible `bg-foreground/[0.02]` backgrounds.

## New Structure — 4 Sections

```text
┌─────────────────────────┐
│  Greeting    Weather ⚙  │  ← compact header
├─────────────────────────┤
│                         │
│   TODAY'S OUTFIT HERO   │  ← large 2x2 grid, occasion pill,
│   [garment images]      │     "Wear this" + "Try another"
│   [Wear this] [Refresh] │     occasion selector inline
│                         │
├─────────────────────────┤
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐   │  ← 4 quick action icons
│  Add  Build  AI  Plan   │     (icon + label, grid)
├─────────────────────────┤
│  Recent Garments  →     │  ← horizontal scroll of last 6
│  [img][img][img][img]   │     garments added/worn
├─────────────────────────┤
│  Saved Outfits    →     │  ← horizontal scroll of saved
│  [card][card][card]     │     outfits (replaces SwipeSuggs)
└─────────────────────────┘
```

## Detailed Changes

### 1. Home Page (`src/pages/Home.tsx`)

Complete restructure to 4 sections:
- **Header**: keep greeting + weather pill + settings (unchanged logic)
- **TodayOutfitCard**: hero card with inline occasion selector
- **QuickActionsGrid**: new component — 4 icon buttons in a 4-column grid
- **RecentGarments**: new component — horizontal scroll of recent garments
- **SavedOutfits**: rename/refactor SwipeSuggestions with polished styling

Remove: `AdjustDaySection`, `SmartInsightCard`, `InsightsBanner`, `PlanTomorrowCard` as standalone modules. Their functionality is absorbed into QuickActionsGrid (Plan, Insights links) and TodayOutfitCard (occasion selection).

Occasion/style state stays in Home but feeds into TodayOutfitCard which now has an inline occasion picker.

### 2. TodayOutfitCard Redesign (`src/components/home/TodayOutfitCard.tsx`)

- Card background: `bg-card border border-border/20 rounded-2xl` (visible dark surface)
- Add occasion pill row inside the card (below "Today's outfit" label): 4 small pills (Everyday, Work, Party, Date) — tapping changes occasion and regenerates
- Larger garment grid: `gap-2` with `rounded-xl` images
- "Wear this" button: full accent color, prominent
- "Try another" button: ghost outline, secondary
- Remove the `see_details →` link (users can tap garment images)
- Keep nice choice feedback + upgrade hint
- Add `relative overflow-hidden` for shimmer overlay fix

### 3. New QuickActionsGrid (`src/components/home/QuickActionsGrid.tsx`)

4 actions in a horizontal grid:
- **Add Garment** (Plus icon) → `/wardrobe/add`
- **Build Outfit** (Layers icon) → `/outfits/generate`
- **AI Stylist** (Bot icon) → `/ai`
- **Plan Week** (CalendarDays icon) → `/plan`

Each: icon in a subtle dark circle + label below. `bg-card border border-border/20 rounded-2xl p-4` card. Tap navigates. Simple, no chevrons.

### 4. New RecentGarments (`src/components/home/RecentGarments.tsx`)

- Fetch last 6 garments ordered by `created_at desc` using `useFlatGarments`
- Horizontal scroll strip with circular or rounded-xl thumbnails (48x48 or 56x56)
- Tap navigates to garment detail
- Section header "Recent" with "See all →" linking to `/wardrobe`
- Only show if user has garments

### 5. SavedOutfits (refactor `SwipeSuggestions.tsx`)

- Rename section header to "Saved Outfits" (translation key `home.saved_outfits`)
- Polish card surface to `bg-card border border-border/20`
- Add "See all →" link to `/outfits`
- Keep existing data fetching and navigation logic

### 6. Translation Keys (`src/i18n/translations.ts`)

Add for sv + en:
- `home.quick_add`: "Add" / "Lägg till"
- `home.quick_build`: "Build" / "Skapa"  
- `home.quick_ai`: "AI Stylist" / "AI Stylist"
- `home.quick_plan`: "Plan" / "Planera"
- `home.recent`: "Recent" / "Senaste"
- `home.saved_outfits`: "Saved Outfits" / "Sparade outfits"
- `home.see_all`: "See all" / "Visa alla"

## Files

| File | Action |
|------|--------|
| `src/pages/Home.tsx` | Rewrite — 4-section layout |
| `src/components/home/TodayOutfitCard.tsx` | Redesign — inline occasion picker, polished surface |
| `src/components/home/QuickActionsGrid.tsx` | **NEW** — 4 action buttons |
| `src/components/home/RecentGarments.tsx` | **NEW** — recent garments strip |
| `src/components/home/SwipeSuggestions.tsx` | Polish — rename to Saved Outfits, surface styling |
| `src/i18n/translations.ts` | Add new keys (sv + en) |

Files no longer imported by Home (kept for other uses):
- `AdjustDaySection.tsx` — removed from Home
- `SmartInsightCard.tsx` — removed from Home
- `InsightsBanner.tsx` — removed from Home
- `PlanTomorrowCard.tsx` — removed from Home

## What Stays

- All business logic (outfit generation, mark worn, subscription checks)
- Pull-to-refresh, AppLayout, BottomNav
- Weather data flow
- Occasion/style localStorage persistence
- Upgrade hint logic

