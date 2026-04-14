# Travel Capsule + Wardrobe Gaps — Full Redesign Spec

## Context

Both Travel Capsule and Wardrobe Gaps are production features in BURS that need a full rethink — not just a visual refresh but a reimagining of how they work. Travel Capsule lacks memory, has limited occasion support, and feels basic. Wardrobe Gaps feels generic, results aren't actionable, and the UI reads like a report rather than a feature.

Both must match the BURS design DNA exactly:
- Editorial Cream (#F5F0E8) background
- Deep Charcoal (#1C1917) foreground
- Warm Gold (#B07D3A) accent
- Playfair Display italic for display/editorial text
- DM Sans for body/UI
- `rounded-[1.25rem]` corners
- Framer Motion with EASE_CURVE
- No emojis anywhere — use lucide-react icons only

---

## Part 1: Travel Capsule Redesign

### 1.1 Input Flow — 3-Step Wizard

Replace the current single-form scroll with a card-based wizard. Each step is a full-width card with smooth Framer Motion transitions (AnimatePresence, slide left/right). Bottom progress dots show current step.

#### Step 1 — "Where and When"

| Field | Component | Notes |
|-------|-----------|-------|
| Destination | LocationAutocomplete (existing) | Globe icon, auto-geocode |
| Dates | Calendar popover (existing) | Shows trip length after selection |
| Weather | Auto-fetch strip | Compact row of day icons + temp range. Fetched when destination + dates are set. |
| Luggage type | 3 pill buttons | "Carry-on only" / "Carry-on + personal" / "Checked bag" |

Weather strip sits below the date picker as a subtle info bar (not a separate section). If weather fails to load, show a muted "Weather unavailable" note — do NOT block generation.

#### Step 2 — "Plan Your Trip"

| Field | Component | Notes |
|-------|-----------|-------|
| Occasions | Multi-select grid (3 columns) | Work meetings, Dinner/evening, Beach/pool, Hiking/outdoor, Nightlife, Wedding/formal, Sightseeing, Airport/travel, Active/sport. Each is a card with a lucide icon + label. Gold border when selected. |
| Companions | 4 pill buttons | Solo / Partner / Friends / Family |
| Style preference | 3 pill buttons | Casual-leaning / Balanced / Dressy-leaning |
| Outfits per day | Stepper (1-4) | Plus/minus buttons |
| Must-have items | Collapsible section | "Anything you must bring?" — opens a garment grid picker. Max 8 items. |
| Minimize items | Toggle switch | "Pack as light as possible" |

Occasions use lucide icons (not emojis):
- Briefcase for work
- Wine for dinner
- Umbrella for beach
- Mountain for hiking
- Music for nightlife
- Heart for wedding/formal
- Map for sightseeing
- Plane for airport
- Dumbbell for active/sport

#### Step 3 — Results (see 1.2)

#### Navigation
- Bottom: 3 progress dots with current-step highlight (gold fill)
- "Next" button (right side, pill shape)
- "Back" button (left side, ghost/quiet variant)
- Each step transition: slide left/right with opacity fade (200ms, EASE_CURVE)

### 1.2 Results — Magazine-Style Editorial

#### Header
- Trip summary: destination (large, Playfair Display italic), dates, weather strip
- Occasion pills (small, muted)
- "Edit trip" ghost button, "Share" ghost button

#### Hero Stat Block
- Large editorial typography: "12 pieces. 8 outfits. 5 days."
- Playfair Display italic, text-[1.5rem], text-foreground/70
- Packing progress bar below (accent gold fill, animated width)

#### Packing Grid
- 3-column grid of garment images (existing LazyImageSimple)
- Each item: image, title truncated below, category pill
- Tap item: shows which outfits use it (overlay or sheet)
- Checkbox overlay (top-right of each image): tap to mark as packed
- Checked items get a subtle opacity reduction (0.5) with a check badge

#### Day-by-Day Outfits
- Vertical scroll of day cards
- Each day card:
  - "Day N" label + date + occasion pill (e.g., "Work meetings")
  - Compact outfit grid (reuse the 4-column garment row from OutfitSuggestionCard)
  - One-line stylist note in Playfair Display italic, text-foreground/50
- Cards separated by 16px spacing

#### Coverage Gaps (conditional)
- If the AI detected missing items, show a subtle card:
  - Warm gold left border (border-l-2 border-accent/40)
  - "Your wardrobe is missing a few pieces for this trip"
  - List of missing items with category labels

#### Action Bar (sticky bottom)
- "Add to planner" primary button (saves outfits to calendar)
- "Start over" ghost button
- Safe-area padding

### 1.3 Trip Memory — Persistent History

#### Database
New table: `travel_capsules`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK to auth.users |
| destination | text | City/country name |
| start_date | date | |
| end_date | date | |
| occasions | text[] | Array of selected occasions |
| luggage_type | text | carry_on / carry_on_personal / checked |
| companions | text | solo / partner / friends / family |
| style_preference | text | casual / balanced / dressy |
| result | jsonb | Full CapsuleResult JSON |
| created_at | timestamptz | |

RLS: user can only read/write own rows.

#### UI
- "Past Trips" section on the Travel Capsule page (below wizard or as a tab)
- Card per trip: destination, dates, item count, outfit count
- Tap card to view saved results (read-only, no re-generation)
- Swipe to delete or long-press menu
- Max 10 trips per user — oldest auto-pruned on save

#### Auto-Save
- When capsule generates successfully, auto-save to DB
- No explicit "save" button — it's always saved

### 1.4 Edge Function Updates

The `travel_capsule` edge function needs these new fields in the request:

```
luggage_type: "carry_on" | "carry_on_personal" | "checked"
companions: "solo" | "partner" | "friends" | "family"
style_preference: "casual" | "balanced" | "dressy"
occasions: string[]  // multi-select, replaces single trip_type
```

**Luggage constraint mapping:**
- carry_on: max 8 garments + 2 shoes
- carry_on_personal: max 12 garments + 2 shoes
- checked: max 18 garments + 3 shoes

**Companions → formality adjustment:**
- solo: neutral
- partner: slight dressy bias
- friends: slight casual bias
- family: comfort/practical bias

**Style preference → scoring weight:**
- casual: boost casual/relaxed garments
- balanced: neutral
- dressy: boost formal/elevated garments

**Multi-occasion support:**
- Each day gets assigned 1-2 occasions from the selected set
- The AI distributes occasions across days (e.g., Day 1: airport + sightseeing, Day 2: work + dinner)
- Outfit scoring accounts for each day's specific occasion

### 1.5 Bugs to Fix

1. **CRITICAL: Race condition** — `useTravelCapsule` line 369-371 uses `setTimeout(100ms)` for weather lookup. Replace with proper async/await in the effect.
2. **Weather should be strongly encouraged** — If weather hasn't loaded when user hits "Generate", show a brief warning toast but allow proceeding.
3. **Border radius inconsistency** — TravelFormView line 169 uses `rounded-[1.2rem]`, should be `rounded-[1.25rem]`.

---

## Part 2: Wardrobe Gaps Redesign

### 2.1 Layout — "Shopping Intelligence"

Replace the report-style layout with an editorial, action-first design.

#### Hero Gap Card (First Result)

Full-width editorial card for the number one shopping recommendation:

- Warm gold radial gradient background (subtle, top-right)
- "Your next best purchase" eyebrow (uppercase, tracking-wide, text-[11px])
- Item description in Playfair Display italic, text-[1.4rem]
- Category and color pills below the title
- **Outfit unlock preview:** 2-3 horizontal mini outfit grids showing "your existing garments + this missing piece". Each mini grid shows 3-4 garment thumbnails from the user's wardrobe + a dashed-border placeholder for the missing item.
- "+N new outfit combinations" stat (large number in Playfair Display, rest in DM Sans)
- Price range badge (muted pill)
- "Find this" primary button (opens Google Shopping search)

#### Secondary Gap Cards (Remaining 2-4 Results)

Horizontal scroll of cards:

- Each card: ~280px wide, full height
- Item name (DM Sans, 15px, font-medium)
- Category pill + color indicator
- Outfit impact: "+N outfits" with accent-colored number
- One-line reason text (DM Sans, 13px, text-foreground/60)
- "Find this" outline button

#### Engagement Features

- **"Why this?" expandable** — tap to reveal the AI's reasoning in editorial prose (Playfair Display italic for the key insight, DM Sans for the explanation)
- **Outfit impact visualization** — on the hero card, show actual garment thumbnails from the user's wardrobe that would pair with the suggested item
- **Last scanned timestamp** with refresh button (top-right of page)

### 2.2 States

| State | Design |
|-------|--------|
| Locked | Lock icon + "Add N more garments to unlock" + WardrobeProgress bar |
| Ready | Radar icon + "Scan your wardrobe" + explanation copy + "Run Scan" primary button |
| Loading | AILoadingOverlay with 3-phase animation (Search, Sparkles, ShoppingBag) |
| Error | AlertCircle + error message + "Retry" button |
| No gaps | Celebration state: "Your wardrobe is well-balanced" with check icon |
| Results | Hero gap + secondary gaps scroll |

### 2.3 Edge Function Updates

The `wardrobe_gap_analysis` function needs these improvements:

1. **Return outfit pairings** — For each gap, include 2-3 garment IDs from the user's wardrobe that would pair with the suggested item. The client uses these to show outfit previews.

2. **Better <5 garment handling** — Instead of returning empty gaps, return a structured error: `{ error: "minimum_garments", required: 5, current: N }`.

3. **Increase sample diversity** — Show 25 garment titles (currently 15) to give the AI a better picture of the wardrobe.

4. **Locale-aware voice** — The `VOICE_GAP_ANALYSIS` prompt should include the locale for price range formatting and cultural relevance.

Updated response shape:
```typescript
interface GapResult {
  item: string;
  category: string;
  color: string;
  reason: string;
  new_outfits: number;
  price_range: string;
  search_query: string;
  // NEW:
  pairing_garment_ids: string[];  // 2-3 IDs from user's wardrobe (validate on client — garments may be deleted between scan and display)
  key_insight: string;            // One-sentence editorial insight
}
```

### 2.4 Bugs to Fix

1. **Generic response for <5 garments** — Return structured error instead of empty array.
2. **Sample size too small** — Increase from 15 to 25 garment titles in the AI prompt.
3. **Missing accessibility** — Google search link should indicate it opens externally.

---

## Part 3: Shared Design Patterns

### Typography Hierarchy

| Element | Font | Size | Weight | Style |
|---------|------|------|--------|-------|
| Page title | Playfair Display | 1.24rem | 400 | italic |
| Section eyebrow | DM Sans | 11px | 500 | uppercase, tracking-wide |
| Hero stat | Playfair Display | 1.5rem | 400 | italic |
| Card title | DM Sans | 15px | 500 | normal |
| Body text | DM Sans | 14px | 400 | normal |
| Caption/label | DM Sans | 12px | 500 | normal |
| Editorial prose | Playfair Display | 14px | 400 | italic |

### Card Surfaces

All cards use:
- `bg-card` background
- `border border-border/40` border
- `rounded-[1.25rem]` corners
- `shadow-sm` on interaction states only
- `p-4` standard padding, `p-5` for feature cards

### Pill Buttons (Selectors)

Active: `bg-foreground text-background border-foreground shadow-sm`
Inactive: `bg-transparent border-border/40 text-foreground/70 hover:border-border/60`
Shape: `rounded-full px-4 py-2`

### Animations

- Page transitions: AnimatedPage wrapper (existing)
- Step transitions: slide + fade (200ms, EASE_CURVE)
- Card entrance: stagger (30ms per card, fade + y:8px)
- Progress bar: width transition (300ms, EASE_CURVE)
- Tab switches: AnimatePresence mode="wait"

### Icon Usage

All icons from lucide-react. No emojis. Icon sizes:
- Feature icons: w-5 h-5
- Inline icons: w-4 h-4
- Badge icons: w-3.5 h-3.5

---

## Part 4: Migration Notes

### Database Migration
- Create `travel_capsules` table with RLS
- No changes needed for wardrobe gaps (uses existing tables)

### Files to Create
- `src/components/travel/TravelWizard.tsx` (3-step wizard container)
- `src/components/travel/TravelStep1.tsx` (Where and When)
- `src/components/travel/TravelStep2.tsx` (Plan Your Trip)
- `src/components/travel/TravelResultsView.tsx` (rewrite)
- `src/components/travel/TripHistoryList.tsx` (past trips)
- `src/components/gaps/GapHeroCard.tsx` (hero gap with outfit preview)
- `src/components/gaps/GapSecondaryCard.tsx` (horizontal scroll cards)
- `src/hooks/useTravelCapsules.ts` (DB persistence hook)

### Files to Modify
- `src/pages/TravelCapsule.tsx` (wire wizard + history)
- `src/pages/GarmentGaps.tsx` (wire new gap components)
- `src/components/travel/useTravelCapsule.ts` (add new fields, fix race condition)
- `src/components/gaps/GapResultsPanel.tsx` (replace with new layout)
- `src/components/gaps/GapStateViews.tsx` (update ready/results states)
- `supabase/functions/travel_capsule/index.ts` (new fields, luggage constraints)
- `supabase/functions/wardrobe_gap_analysis/index.ts` (pairing IDs, better prompts)
- `src/i18n/locales/en.ts` and `sv.ts` (new keys, append-only)

### Files to Delete (replaced by new components)
- `src/components/travel/TravelFormView.tsx` (replaced by TravelStep1 + TravelStep2)
