
# Today Screen -- Complete Rebuild

## Overview
Transform the Today page from a "choose and generate" workflow into an "outfit-first" experience. The AI auto-generates an outfit on load. The user's primary decision is binary: "Wear this" or "Try another". Configuration (occasion/style) is hidden in a collapsed section.

## Current vs New Structure

```text
CURRENT                          NEW
---------------------------------|---------------------------------
Greeting + Weather               | Greeting + Weather (compact)
Onboarding nudge                 | Primary Outfit Card (60-70% view)
Outfit Builder Card              |   - Large garment grid
  - Occasion chips (6+)          |   - [Wear this] [Try another]
  - Sub-option chips             | Swipe Suggestions (horizontal)
  - Style chips (10)             | "Adjust your day" (collapsed)
  - Generate button              |   - 4 occasion pills
Stats strip                      |   - 4 style pills
AI Suggestions card              |   - [Update outfit]
                                 | Smart Insight Card
```

## New Components

### 1. `src/components/home/TodayOutfitCard.tsx`
The dominant card occupying most of the viewport.
- Uses `useOutfitGenerator` to auto-generate an outfit on mount (using last occasion or "vardag" default + weather context)
- Shows a 2x2 garment image grid (large, aspect-[4/5])
- Two buttons: "Wear this" (accent filled) and "Try another" (outline)
- "Wear this" triggers `useMarkOutfitWorn`, shows success micro-animation + haptic
- "Try another" triggers regeneration with shimmer/crossfade transition
- Free user: after 3 regenerations, shows inline text "Unlock unlimited outfit ideas" with small link (no popup)
- Loading state: shimmer skeleton matching the card dimensions
- Stores current outfit in local state, persists to `outfits` table

### 2. `src/components/home/SwipeSuggestions.tsx`
Horizontal scroll of large visual outfit cards.
- Fetches recent outfits from `useOutfits()`
- Each card: garment grid thumbnail + small occasion pill overlay
- No text descriptions
- Tap navigates to `/outfits/{id}`
- Uses `aspect-[3/4]` cards, `w-[200px]` width

### 3. `src/components/home/AdjustDaySection.tsx`
Collapsed-by-default section replacing the current occasion/style builder.
- Uses Radix Collapsible
- Header: "Adjust your day" + chevron
- Content: 4 occasion pills (Everyday, Work, Party, Date) -- reduced from 6
- 4 style pills (Minimal, Street, Smart casual, Classic) -- reduced from 10
- Single "Update outfit" button that regenerates with new params
- Max 2 rows of pills

### 4. `src/components/home/SmartInsightCard.tsx`
Small card at the bottom.
- Shows count of unused items (from `useInsights`)
- Example: "7 items haven't been worn in 30 days"
- Button: "Use them today" -- generates outfit prioritizing unused garments
- Replaces the current heavy `AISuggestions` component and stats strip

## Changes to Existing Files

### `src/pages/Home.tsx` -- Full Rewrite
- Remove: OCCASIONS array (moved to AdjustDaySection), STYLES array, stats strip, AISuggestions import, onboarding nudge card
- Keep: greeting logic, weather hook, pull-to-refresh, AppLayout, paywall modal
- Add: auto-generate outfit on mount, state for current outfit, regeneration counter
- Layout order: Header, TodayOutfitCard, SwipeSuggestions, AdjustDaySection, SmartInsightCard

### `src/hooks/useOutfitGenerator.ts` -- No changes needed
The existing hook already supports the generation flow.

### `src/hooks/useOutfits.ts` -- No changes needed
Existing `useOutfits()` already fetches recent outfits for the swipe suggestions.

## Interaction Details

### Auto-generation on mount
- On first load, auto-generate using last saved occasion (localStorage) or "vardag" + current weather
- Show shimmer skeleton during generation (3-5 seconds)
- Cache the result so returning to the tab shows it instantly (React Query)

### "Wear this" flow
1. Haptic feedback (hapticSuccess)
2. Garment grid does a subtle scale pulse (1.02 -> 1)
3. Small text "Nice choice." fades in below buttons for 2 seconds
4. Calls `useMarkOutfitWorn` to update wear counts

### "Try another" flow
1. Haptic feedback (hapticLight)
2. Current outfit fades out with slight scale-down
3. Shimmer overlay appears briefly
4. New outfit fades in with scale-up (0.98 -> 1)
5. Increment local regeneration counter

### Free user paywall (inline, not popup)
- Track regeneration count in component state
- After 3 "Try another" taps: show `p` tag below buttons
- Text: "Unlock unlimited outfit ideas" + small accent-colored link to pricing
- No PaywallModal popup -- remove that interaction from Today

## Visual Specs (matching existing design system)
- Card: `rounded-2xl bg-foreground/[0.02] border border-border/30`
- Garment grid: `grid grid-cols-2 gap-1.5`, each item `aspect-[4/5] rounded-xl overflow-hidden`
- Buttons: accent filled (`bg-accent text-accent-foreground rounded-xl h-12`) and outline
- Collapsed section: `bg-foreground/[0.02] rounded-2xl`
- Insight card: `bg-foreground/[0.02] rounded-xl p-4`
- All animations use existing `EASE_CURVE`, `TAP_TRANSITION` from `@/lib/motion`

## Translation Keys Needed
New keys to add to `src/i18n/translations.ts`:
- `home.todays_outfit` -- "Today's outfit"
- `home.wear_this` -- "Wear this"
- `home.try_another` -- "Try another"
- `home.nice_choice` -- "Nice choice."
- `home.unlock_unlimited` -- "Unlock unlimited outfit ideas"
- `home.adjust_day` -- "Adjust your day"
- `home.update_outfit` -- "Update outfit"
- `home.unused_hint` -- "{count} items haven't been worn in 30 days"
- `home.use_them` -- "Use them today"
- `home.suggestions` -- "More outfits"

## Implementation Order
1. Add translation keys
2. Create `TodayOutfitCard` component (core experience)
3. Create `SwipeSuggestions` component
4. Create `AdjustDaySection` component
5. Create `SmartInsightCard` component
6. Rewrite `Home.tsx` to compose all sections
7. Test the full flow
