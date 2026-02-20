

## Redesign the Planner Page -- Clean, Minimal, Fun

### Design Philosophy

Match the Home page's calm, spacious aesthetic: flat card containers, generous whitespace, subtle animations, and zero visual noise. The planner becomes a single scrollable view focused on **one day at a time**, with the week navigation as a compact strip at the top.

### Current Problems
- Too many borders, badges, and nested cards competing for attention
- DaySummaryCard, WeatherBadge, CalendarConnectBanner, outfit grid, action buttons all stacked vertically with no breathing room
- Desktop layout has a heavy sidebar with 7 MiniDayCards that look cluttered
- Hardcoded Swedish still present in several planner sub-components

### New Layout (Mobile)

```text
+---------------------------------------+
|  Header: "Today" + calendar icon      |
+---------------------------------------+
|  Week Strip (7 day pills, cleaner)    |
+---------------------------------------+
|                                       |
|  Weather + Temperature (subtle line)  |
|                                       |
|  AI Summary Card (if events exist)    |
|   "Work-focused day with evening      |
|    social. Smart casual recommended." |
|   [Jobb chip] [Fest chip]             |
|                                       |
|  Outfit Section:                      |
|   Either:                             |
|     2x2 image grid (tap to detail)    |
|     Occasion + style badges           |
|     One-line explanation              |
|     [Swap] [Details] row              |
|     Worn / Remove (tiny footer)       |
|   Or:                                 |
|     Empty state with Generate CTA     |
|                                       |
+---------------------------------------+
```

### New Layout (Desktop)

Same vertical flow in a centered `max-w-lg` column -- no more split panel. The WeekStrip works identically on desktop. This is simpler, cleaner, and matches the Home page pattern.

### Specific Changes

**1. `src/pages/Plan.tsx` -- Complete rewrite of layout**
- Remove the desktop two-panel `grid` layout entirely; use single-column `max-w-lg mx-auto` for both mobile and desktop (same as Home page)
- Remove `MiniDayCard` imports and usage (desktop sidebar gone)
- Simplify header: just the date label + calendar popover + magic wand button
- Add stagger animation on day switch using React `key` on the content wrapper
- Remove `CalendarConnectBanner` from inline flow -- move it to a subtle bottom-sheet nudge or keep as a single-line prompt
- Fix remaining hardcoded `sv` locale in date formatting (use dynamic locale)

**2. `src/components/plan/WeekStrip.tsx` -- Visual refinement**
- Make pills taller with more padding for easier touch targets
- Selected state: filled pill with `bg-foreground text-background` (ink/paper inversion) instead of `bg-primary`
- Unselected: transparent with just the day letter + number
- Remove the bottom indicator dots/icons row -- too noisy. Instead, show a tiny colored dot only for days with a planned outfit (green=worn, accent=planned)
- Remove tooltip wrapping -- events are shown in the detail area, not on hover
- Use dynamic date-fns locale instead of hardcoded `sv`

**3. `src/components/plan/DaySummaryCard.tsx` -- Cleaner card**
- Remove border entirely; use a soft background tint only (`bg-muted/40 rounded-xl`)
- Remove the "Din dag" header with Sparkles icon -- let the summary speak for itself
- Occasion hint chips: keep them but make them subtler (outline style, no background color)
- Remove the "Planera utifrån detta" CTA link -- tapping a chip already triggers generate
- Fix hardcoded Swedish "Din dag" and "Planera utifrån detta" with `t()` keys

**4. `src/components/plan/MiniDayCard.tsx` -- Keep file but stop importing in Plan.tsx**
- No changes needed; it just won't be used in the planner anymore (may still be used elsewhere)

**5. `src/components/plan/CalendarConnectBanner.tsx` -- i18n fix**
- Replace all hardcoded Swedish strings with `t()` calls
- Already has translation keys from the previous bulk i18n work -- just wire them up

**6. `src/components/outfit/WeatherForecastBadge.tsx` -- i18n fix**
- Replace "Laddar...", "Prognos ej tillgänglig", "Ta med paraply!", "Kallt! Klä dig varmt", etc. with `t()` calls
- Add new translation keys for weather warnings

**7. `src/components/plan/SmartDayBanner.tsx` -- i18n fix**
- Replace "Smart förslag baserat på dina händelser" and "Skapa outfit utifrån detta" with `t()` calls

**8. `src/i18n/translations.ts` -- New keys**
- Add keys: `plan.your_day`, `plan.plan_from_hint`, `weather.loading`, `weather.unavailable`, `weather.bring_umbrella`, `weather.cold_warning`, `weather.hot_warning`, `weather.outfit_created_for`, `weather.differs`, `smart.title`, `smart.create_from`, `calendar.connect_title`, `calendar.connect_subtitle`, `calendar.connect_calendar`, `calendar.or_ics`, `calendar.paste_ics`, `calendar.sync`
- Translations for sv, en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa

**9. Animation improvements**
- Day content transitions with `key={selectedDateStr}` and `animate-drape-in` for smooth day switching
- WeekStrip pill selection uses CSS `transition-all duration-200` for color/scale changes
- Outfit image grid has a subtle `hover:scale-[1.01]` lift effect
- Action buttons use `press` class for tactile feedback

### Files Modified

| File | What changes |
|------|-------------|
| `src/pages/Plan.tsx` | Single-column layout, remove desktop split, cleaner spacing, dynamic locale |
| `src/components/plan/WeekStrip.tsx` | Visual refresh: ink/paper selected state, remove dots/tooltips, dynamic locale |
| `src/components/plan/DaySummaryCard.tsx` | Remove border, simpler header, i18n |
| `src/components/plan/CalendarConnectBanner.tsx` | Wire up existing i18n keys |
| `src/components/outfit/WeatherForecastBadge.tsx` | i18n all strings |
| `src/components/plan/SmartDayBanner.tsx` | i18n all strings |
| `src/i18n/translations.ts` | ~20 new translation keys across all locales |

### What stays the same
- All sheet components (PlanningSheet, QuickGenerateSheet, SwapSheet, QuickPlanSheet, PreselectDateSheet) -- they work well as bottom sheets
- All data hooks (usePlannedOutfits, useDaySummary, useOutfitGenerator, etc.)
- The DayCard component file stays but is no longer used by the Plan page
- Core functionality: plan, generate, swap, mark worn, remove

