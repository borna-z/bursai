

# Today Page -- Complete Redesign

Rebuilding the Today page from scratch with three seamless sections: a compact weather + outfit creator, inline insights, and a full insights view. Every element earns its place -- no visual noise, only actionable data.

---

## New Layout Structure

The page drops the tab switcher entirely. Instead, it flows as one continuous scroll with clear sections separated by whitespace:

```text
+----------------------------------+
|  Greeting + compact weather      |
+----------------------------------+
|  "What's today?" occasion row    |
|  Style chips (optional)          |
|  [Generate Outfit] button        |
+----------------------------------+
|  Quick Stats (inline, no cards)  |
+----------------------------------+
|  AI Suggestion (1 card)          |
+----------------------------------+
|  Top 3 worn (compact list)       |
+----------------------------------+
|  [See all insights ->]           |
+----------------------------------+
```

---

## Section-by-Section Design

### 1. Greeting + Compact Weather (merged into one line)

**Current problem**: The WeatherWidget is a large card with a 5-day forecast strip that takes ~200px of vertical space before any actionable content.

**New design**: Merge greeting and weather into a single row.
- Left: "God morgon, Erik" (text-lg, Sora font)
- Right: compact weather pill showing `18° Sun` with a small icon (no forecast strip, no location picker, no time)
- Tapping the weather pill expands to show 3-day forecast inline (collapsible, closed by default)
- The location picker moves inside the expanded state

This saves ~150px of prime screen real estate.

### 2. Occasion Selector (streamlined)

**Current problem**: 6 occasions in a 2-column grid takes a lot of vertical space. Sub-options add another section.

**New design**: 
- Single horizontal scroll row of occasion pills (not a grid). Each pill has icon + label.
- Selected occasion expands sub-options as a second row below (also horizontal scroll pills)
- This reduces the occasion area from ~200px to ~80px

### 3. Style + Generate

- Style chips remain as horizontal scroll (unchanged, already good)
- Generate button: full-width, prominent, but `h-12` not `h-14` (slightly less dominant)
- Cold weather hint moves to a small inline note above the button if applicable

### 4. Quick Stats Strip (new -- replaces stat cards)

**Current problem**: Three separate Card components with large text for total/usage/unused stats take significant space.

**New design**: A single row with three inline metrics, no cards:
```
42 plagg    67% använt    8 oanvända
```
- Just text: large number + small label below each
- Separated by thin vertical dividers
- No card borders, no shadows -- pure typography
- Tapping any stat navigates to full Insights page

### 5. AI Suggestion (kept, slightly refined)

- Keep the single AI suggestion card (already limited to 1)
- Remove the Card wrapper -- render directly as a borderless section
- Garment thumbnails slightly larger: `w-14 h-14` (from `w-16 h-16` -- actually keep current)
- "Why this works" collapsible stays

### 6. Top 3 Worn (compact)

- Show top 3 most-worn garments as small avatar-sized thumbnails in a row with name and wear count
- No card wrapper, just a clean list with tiny dividers
- Only show if there are worn garments in last 30 days

### 7. "See all insights" link

- Simple ghost button at the bottom linking to /insights
- Replaces the current tab system entirely

---

## Full Insights Page (/insights) -- Polish

The dedicated Insights page keeps its current structure but gets the same minimalist treatment:

- Remove gradient backgrounds from stat cards (just clean numbers)
- Remove premium upsell banner from the top (move to bottom as subtle text link)
- Tighten spacing: `space-y-5` from `space-y-6`
- Color Distribution chart: remove the Card wrapper, render directly
- Unused Gems: show as simple list, no elaborate card layout

---

## What Gets Removed

1. **Tab switcher** ("Create" / "Insights") -- gone. Everything flows as one page.
2. **Large WeatherWidget** with 5-day forecast on the main view -- collapsed by default.
3. **Three stat cards** -- replaced with inline text strip.
4. **Usage bar card** -- removed from home (exists in full Insights page).
5. **Unused garments card** on home -- simplified to just the count in the stats strip.

## What Gets Added

1. **Compact weather pill** merged with greeting -- new component `WeatherPill`
2. **Horizontal occasion scroll** -- replaces the 2-col grid
3. **Inline stats strip** -- replaces 3 card components
4. **Expandable weather detail** -- 3-day forecast on tap

---

## Technical Details

### Files to create:
1. `src/components/weather/WeatherPill.tsx` -- Compact weather display with expandable forecast

### Files to modify:
1. `src/pages/Home.tsx` -- Complete rewrite of the page layout
2. `src/pages/Insights.tsx` -- Simplify card styles, remove gradients, tighten spacing

### Files unchanged:
- `src/hooks/useInsights.ts` -- data layer stays the same
- `src/hooks/useWeather.ts` -- data layer stays the same  
- `src/hooks/useForecast.ts` -- data layer stays the same
- `src/components/insights/AISuggestions.tsx` -- kept as-is (already well-designed)
- `src/components/weather/WeatherWidget.tsx` -- kept for other pages, new WeatherPill for Home

### No new dependencies needed.

### Risk: Low
- All logic (weather fetching, outfit generation, insights data) remains unchanged
- Only the presentation layer is rebuilt
- The occasion/style/generate flow keeps the exact same navigation and state logic

