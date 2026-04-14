# Travel Capsule + Wardrobe Gaps Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full rethink of Travel Capsule (3-step wizard, multi-occasion, trip memory) and Wardrobe Gaps (editorial shopping intelligence with outfit pairing previews).

**Architecture:** Two independent phases. Phase A rewrites Travel Capsule with a wizard flow, new edge function fields, and DB-backed trip history. Phase B rewrites Wardrobe Gaps with a hero card layout, pairing garment previews, and improved AI prompt. Shared design patterns (typography, cards, pills, animations) are defined once and reused.

**Tech Stack:** React 18 + TypeScript 5.8 + Vite, Supabase (PostgreSQL + Edge Functions), TanStack React Query v5, Radix UI + shadcn/ui + Tailwind CSS, Framer Motion, lucide-react icons.

---

## File Map

### Phase A — Travel Capsule

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/travel/TravelWizard.tsx` | **Create** | 3-step wizard container with AnimatePresence transitions, progress dots, back/next nav |
| `src/components/travel/TravelStep1.tsx` | **Create** | "Where and When" — destination, dates, weather strip, luggage type |
| `src/components/travel/TravelStep2.tsx` | **Create** | "Plan Your Trip" — occasions grid, companions, style, outfits/day, must-haves, minimize |
| `src/components/travel/TripHistoryList.tsx` | **Create** | Past trips list from DB with delete |
| `src/hooks/useTravelCapsules.ts` | **Create** | React Query hooks for travel_capsules DB table (list, save, delete) |
| `src/components/travel/types.ts` | **Modify** | Add new types: LuggageType, Companion, StylePreference, OccasionId |
| `src/components/travel/useTravelCapsule.ts` | **Modify** | Add new fields (luggage, companions, style, multi-occasion), fix race condition |
| `src/components/travel/TravelResultsView.tsx` | **Modify** | Magazine-style editorial layout with hero stats, packing grid, day cards |
| `src/pages/TravelCapsule.tsx` | **Modify** | Wire wizard + trip history |
| `supabase/functions/travel_capsule/index.ts` | **Modify** | Accept new fields, luggage constraints, companion/style scoring |
| `src/i18n/locales/en.ts` + `sv.ts` | **Modify** | Append travel.* keys |

### Phase B — Wardrobe Gaps

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/gaps/GapHeroCard.tsx` | **Create** | Hero gap card with outfit pairing preview |
| `src/components/gaps/GapSecondaryCard.tsx` | **Create** | Compact horizontal-scroll gap card |
| `src/components/gaps/GapResultsPanel.tsx` | **Modify** | Replace with hero + scroll layout |
| `src/components/gaps/GapStateViews.tsx` | **Modify** | Update ready/results state views |
| `src/components/gaps/gapTypes.ts` | **Modify** | Add pairing_garment_ids, key_insight to GapResult |
| `src/pages/GarmentGaps.tsx` | **Modify** | Wire new components |
| `supabase/functions/wardrobe_gap_analysis/index.ts` | **Modify** | Pairing IDs, better prompt, <5 garment error |
| `src/i18n/locales/en.ts` + `sv.ts` | **Modify** | Append gaps.* keys |

### Database

| Migration | Table |
|-----------|-------|
| `create_travel_capsules_table` | `travel_capsules` with RLS |

---

## Phase A: Travel Capsule

### Task 1: Database — travel_capsules table

- [ ] **Step 1: Apply migration**

```sql
CREATE TABLE travel_capsules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  occasions text[] DEFAULT '{}',
  luggage_type text DEFAULT 'carry_on_personal',
  companions text DEFAULT 'solo',
  style_preference text DEFAULT 'balanced',
  result jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE travel_capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own capsules"
  ON travel_capsules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_travel_capsules_user ON travel_capsules (user_id, created_at DESC);
```

Use `apply_migration` MCP tool with project_id `khvkwojtlkcvxjxztduj`.

- [ ] **Step 2: Commit**

```
feat: create travel_capsules table with RLS
```

---

### Task 2: Types — extend travel types

**Files:**
- Modify: `src/components/travel/types.ts`

- [ ] **Step 1: Add new types**

Append after the existing `VibeId` type:

```typescript
export type LuggageType = 'carry_on' | 'carry_on_personal' | 'checked';
export type Companion = 'solo' | 'partner' | 'friends' | 'family';
export type StylePreference = 'casual' | 'balanced' | 'dressy';

export type OccasionId =
  | 'work' | 'dinner' | 'beach' | 'hiking'
  | 'nightlife' | 'wedding' | 'sightseeing'
  | 'airport' | 'active';

export const OCCASIONS: { id: OccasionId; labelKey: string; icon: string }[] = [
  { id: 'work', labelKey: 'travel.occasion_work', icon: 'Briefcase' },
  { id: 'dinner', labelKey: 'travel.occasion_dinner', icon: 'Wine' },
  { id: 'beach', labelKey: 'travel.occasion_beach', icon: 'Umbrella' },
  { id: 'hiking', labelKey: 'travel.occasion_hiking', icon: 'Mountain' },
  { id: 'nightlife', labelKey: 'travel.occasion_nightlife', icon: 'Music' },
  { id: 'wedding', labelKey: 'travel.occasion_wedding', icon: 'Heart' },
  { id: 'sightseeing', labelKey: 'travel.occasion_sightseeing', icon: 'Map' },
  { id: 'airport', labelKey: 'travel.occasion_airport', icon: 'Plane' },
  { id: 'active', labelKey: 'travel.occasion_active', icon: 'Dumbbell' },
];

export const LUGGAGE_LIMITS: Record<LuggageType, { garments: number; shoes: number }> = {
  carry_on: { garments: 8, shoes: 2 },
  carry_on_personal: { garments: 12, shoes: 2 },
  checked: { garments: 18, shoes: 3 },
};

export interface TravelCapsuleRow {
  id: string;
  user_id: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  occasions: string[];
  luggage_type: string;
  companions: string;
  style_preference: string;
  result: CapsuleResult;
  created_at: string;
}
```

Also update `TravelCapsuleInputSnapshot` to include the new fields:

```typescript
export interface TravelCapsuleInputSnapshot {
  destination: string;
  destCoords: { lat: number; lon: number } | null;
  dateRange: { from: string; to: string } | null;
  vibe: VibeId;
  outfitsPerDay: number;
  minimizeItems: boolean;
  includeTravelDays: boolean;
  mustHaveItems: string[];
  // New fields
  luggageType: LuggageType;
  companions: Companion;
  stylePreference: StylePreference;
  occasions: OccasionId[];
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit --skipLibCheck
```

- [ ] **Step 3: Commit**

```
feat: add travel capsule types — luggage, companions, style, occasions
```

---

### Task 3: DB persistence hook — useTravelCapsules

**Files:**
- Create: `src/hooks/useTravelCapsules.ts`

- [ ] **Step 1: Implement the hook**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TravelCapsuleRow, CapsuleResult } from '@/components/travel/types';

const MAX_CAPSULES = 10;

export function useTravelCapsules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['travel-capsules', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('travel_capsules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_CAPSULES);
      if (error) throw error;
      return (data ?? []) as TravelCapsuleRow[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (capsule: {
      destination: string;
      start_date: string | null;
      end_date: string | null;
      occasions: string[];
      luggage_type: string;
      companions: string;
      style_preference: string;
      result: CapsuleResult;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Prune oldest if at limit
      const existing = query.data ?? [];
      if (existing.length >= MAX_CAPSULES) {
        const oldest = existing[existing.length - 1];
        await supabase.from('travel_capsules').delete().eq('id', oldest.id);
      }

      const { data, error } = await supabase
        .from('travel_capsules')
        .insert({ user_id: user.id, ...capsule })
        .select()
        .single();
      if (error) throw error;
      return data as TravelCapsuleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-capsules', user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('travel_capsules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-capsules', user?.id] });
    },
  });

  return {
    capsules: query.data ?? [],
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    remove: deleteMutation.mutateAsync,
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```
feat: add useTravelCapsules hook for DB-backed trip history
```

---

### Task 4: TravelWizard — 3-step container

**Files:**
- Create: `src/components/travel/TravelWizard.tsx`

- [ ] **Step 1: Implement the wizard**

This is the container that holds Step 1, Step 2, and delegates to the existing result generation. It manages `currentStep` state (0, 1, 2) and renders AnimatePresence transitions.

Key patterns:
- `AnimatePresence mode="wait"` wrapping the step cards
- Each step slides left on "Next", right on "Back" using `motion.div` with `x` variants
- Progress dots at the bottom: 3 dots, current = `bg-accent`, others = `bg-border/40`
- "Next" pill button (right), "Back" ghost button (left)
- Step 2 "Next" button text changes to "Generate Capsule" and calls `onGenerate()`

Props: receives all form state from `useTravelCapsule` plus `onGenerate` callback.

Component should be ~150 lines. Use `EASE_CURVE` from `@/lib/motion`. Icons from lucide-react only. All text via `t()` from `useLanguage`.

- [ ] **Step 2: Typecheck + commit**

```
feat: add TravelWizard 3-step container with animated transitions
```

---

### Task 5: TravelStep1 — Where and When

**Files:**
- Create: `src/components/travel/TravelStep1.tsx`

- [ ] **Step 1: Implement step 1**

Renders:
1. Destination input (reuse existing `LocationAutocomplete` component from `@/components/ui/location-autocomplete`)
2. Date range calendar popover (reuse existing pattern from TravelFormView)
3. Weather strip — compact row showing fetched forecast days (icon + temp). If not loaded, show muted "Weather loads automatically" text.
4. Luggage type — 3 pill buttons: "Carry-on only" / "Carry-on + personal" / "Checked bag"

Each field is a card section with `label-editorial` class for labels. Pill button pattern from spec:
- Active: `bg-foreground text-background border-foreground shadow-sm`
- Inactive: `bg-transparent border-border/40 text-foreground/70`

Props: form state from parent (destination, setDestination, dateRange, setDateRange, weatherForecast, forecastDays, luggageType, setLuggageType, etc.)

- [ ] **Step 2: Typecheck + commit**

```
feat: add TravelStep1 — destination, dates, weather, luggage
```

---

### Task 6: TravelStep2 — Plan Your Trip

**Files:**
- Create: `src/components/travel/TravelStep2.tsx`

- [ ] **Step 1: Implement step 2**

Renders:
1. **Occasions grid** — 3-column grid of selectable cards. Each has a lucide icon + label. Multi-select with gold border when active. Use `OCCASIONS` array from types.ts. Icon mapping: dynamically import from lucide-react using the icon name string.
2. **Companions** — 4 pill buttons (Solo / Partner / Friends / Family)
3. **Style preference** — 3 pill buttons (Casual / Balanced / Dressy)
4. **Outfits per day** — stepper with +/- buttons (min 1, max 4)
5. **Must-have items** — collapsible section. When expanded, shows a garment grid picker from `useFlatGarments()`. Max 8 items. Selected items shown as mini thumbnails.
6. **Minimize items** — toggle switch

Props: form state from parent (occasions, setOccasions, companions, setCompanions, etc.)

- [ ] **Step 2: Typecheck + commit**

```
feat: add TravelStep2 — occasions, companions, style, must-haves
```

---

### Task 7: Update useTravelCapsule hook

**Files:**
- Modify: `src/components/travel/useTravelCapsule.ts`

- [ ] **Step 1: Add new state variables**

Add after existing state:
```typescript
const [luggageType, setLuggageType] = useState<LuggageType>('carry_on_personal');
const [companions, setCompanions] = useState<Companion>('solo');
const [stylePreference, setStylePreference] = useState<StylePreference>('balanced');
const [occasions, setOccasions] = useState<OccasionId[]>([]);
```

- [ ] **Step 2: Fix the race condition**

Replace `setTimeout(lookupWeatherWithCoords, 100)` at ~line 369 with proper async handling:
```typescript
// Instead of setTimeout, use the existing effect that watches destCoords
// The weather lookup is already triggered by destCoords changes
```

Remove the setTimeout and let the existing `useEffect` dependency on `destCoords` handle the lookup.

- [ ] **Step 3: Update handleGenerate to send new fields**

In the edge function body object (~line 410), add:
```typescript
luggage_type: luggageType,
companions,
style_preference: stylePreference,
occasions,  // replaces the old VIBE_TO_OCCASIONS mapping
```

- [ ] **Step 4: Auto-save to DB after generation**

After successful result, call the save function from `useTravelCapsules`:
```typescript
// After setResult(data) succeeds:
saveCapsule({
  destination,
  start_date: dateRange?.from ?? null,
  end_date: dateRange?.to ?? null,
  occasions,
  luggage_type: luggageType,
  companions,
  style_preference: stylePreference,
  result: data,
});
```

- [ ] **Step 5: Update return object with new state**

Add to the hook return: `luggageType, setLuggageType, companions, setCompanions, stylePreference, setStylePreference, occasions, setOccasions`.

- [ ] **Step 6: Typecheck + commit**

```
feat: update useTravelCapsule — new fields, fix race condition, auto-save
```

---

### Task 8: TripHistoryList component

**Files:**
- Create: `src/components/travel/TripHistoryList.tsx`

- [ ] **Step 1: Implement trip history list**

Shows past trips from `useTravelCapsules()`. Each trip is a card with:
- Destination (Playfair Display italic, 15px)
- Date range (DM Sans, 12px, muted)
- Item count + outfit count pills
- Delete button (Trash2 icon, destructive ghost)

Tap card → calls `onSelectTrip(capsule)` to view saved results.

Framer Motion: stagger entrance (30ms per card). Empty state: return null (hidden).

- [ ] **Step 2: Typecheck + commit**

```
feat: add TripHistoryList component for past capsules
```

---

### Task 9: Wire wizard into TravelCapsule page

**Files:**
- Modify: `src/pages/TravelCapsule.tsx`

- [ ] **Step 1: Replace form view with wizard**

Replace the `TravelFormView` import and render with `TravelWizard`. When `!capsule.result`, render the wizard. Below it, render `TripHistoryList` if there are saved capsules.

When viewing a saved capsule (from history), render `TravelResultsView` in read-only mode (no "Edit trip" — just "Back to planner").

- [ ] **Step 2: Delete old TravelFormView**

Remove `src/components/travel/TravelFormView.tsx` (replaced by Step1 + Step2 + Wizard).

- [ ] **Step 3: Typecheck + build + commit**

```
feat: wire TravelWizard into page, remove old form view
```

---

### Task 10: Update travel_capsule edge function

**Files:**
- Modify: `supabase/functions/travel_capsule/index.ts`

- [ ] **Step 1: Parse new fields from request body**

Add to the body destructuring:
```typescript
const { luggage_type, companions, style_preference, occasions, ...rest } = body;
```

- [ ] **Step 2: Add luggage constraints**

```typescript
const LUGGAGE_LIMITS: Record<string, { garments: number; shoes: number }> = {
  carry_on: { garments: 8, shoes: 2 },
  carry_on_personal: { garments: 12, shoes: 2 },
  checked: { garments: 18, shoes: 3 },
};
const limits = LUGGAGE_LIMITS[luggage_type] ?? LUGGAGE_LIMITS.carry_on_personal;
```

Apply `limits.garments` and `limits.shoes` as max constraints in the garment selection phase.

- [ ] **Step 3: Add companion/style scoring adjustments**

In `scorePackWorthiness()`, adjust formality score:
- companions === 'partner': +0.5 to formality 4+ garments
- companions === 'friends': +0.5 to formality 1-2 garments
- companions === 'family': +0.3 to formality 2-3 garments
- style_preference === 'casual': +1.0 to casual garments
- style_preference === 'dressy': +1.0 to formal garments

- [ ] **Step 4: Handle multi-occasion in prompt**

Replace the single `trip_type` context with multi-occasion distribution. In the AI prompt, list the occasions per day:
```
Day 1 (Mon Apr 14): airport + sightseeing
Day 2 (Tue Apr 15): work + dinner
...
```

- [ ] **Step 5: Typecheck + commit**

```
feat: travel_capsule edge fn — luggage limits, companions, multi-occasion
```

---

### Task 11: Travel Capsule i18n keys

**Files:**
- Modify: `src/i18n/locales/en.ts` and `sv.ts`

- [ ] **Step 1: Append travel keys**

```typescript
// en.ts
'travel.step1_title': 'Where and when',
'travel.step2_title': 'Plan your trip',
'travel.step3_title': 'Your capsule',
'travel.luggage_carry_on': 'Carry-on only',
'travel.luggage_carry_on_personal': 'Carry-on + personal',
'travel.luggage_checked': 'Checked bag',
'travel.companions_solo': 'Solo',
'travel.companions_partner': 'Partner',
'travel.companions_friends': 'Friends',
'travel.companions_family': 'Family',
'travel.style_casual': 'Casual',
'travel.style_balanced': 'Balanced',
'travel.style_dressy': 'Dressy',
'travel.occasion_work': 'Work',
'travel.occasion_dinner': 'Dinner',
'travel.occasion_beach': 'Beach',
'travel.occasion_hiking': 'Hiking',
'travel.occasion_nightlife': 'Nightlife',
'travel.occasion_wedding': 'Wedding',
'travel.occasion_sightseeing': 'Sightseeing',
'travel.occasion_airport': 'Travel day',
'travel.occasion_active': 'Active',
'travel.past_trips': 'Past trips',
'travel.generate': 'Generate capsule',
'travel.next': 'Next',
'travel.back': 'Back',
```

Plus Swedish equivalents in sv.ts.

- [ ] **Step 2: Commit**

```
feat: add travel capsule i18n keys (en + sv)
```

---

## Phase B: Wardrobe Gaps

### Task 12: Update GapResult type

**Files:**
- Modify: `src/components/gaps/gapTypes.ts`

- [ ] **Step 1: Add new fields**

```typescript
export interface GapResult {
  item: string;
  category: string;
  color: string;
  reason: string;
  new_outfits: number;
  price_range: string;
  search_query: string;
  // New
  pairing_garment_ids: string[];
  key_insight: string;
}
```

- [ ] **Step 2: Typecheck + commit**

```
feat: add pairing_garment_ids and key_insight to GapResult
```

---

### Task 13: GapHeroCard component

**Files:**
- Create: `src/components/gaps/GapHeroCard.tsx`

- [ ] **Step 1: Implement hero gap card**

Full-width editorial card for the #1 gap result. Layout:

1. Warm gold radial gradient bg (subtle, top-right corner)
2. Eyebrow: "YOUR NEXT BEST PURCHASE" (DM Sans, 11px, uppercase, tracking-wide, text-accent/60)
3. Item name in Playfair Display italic, text-[1.4rem]
4. Category + color pills (small, muted border)
5. **Outfit pairing preview:** horizontal row of 2-3 mini outfit grids. Each shows garment thumbnails from `pairing_garment_ids` (resolved via `useGarmentsByIds`) + a dashed-border placeholder square for the missing item.
6. "+N new outfit combinations" (N in Playfair Display text-accent, rest in DM Sans)
7. Key insight text (Playfair Display italic, text-[13px], text-foreground/55)
8. Price range pill
9. "Find this" primary button → `window.open(googleSearchUrl, '_blank', 'noopener')`

Props: `gap: GapResult`, `garmentMap: Map<string, GarmentBasic>`

Use `motion.div` for entrance animation. `rounded-[1.25rem]`, `border-border/40`.

- [ ] **Step 2: Typecheck + commit**

```
feat: add GapHeroCard with editorial layout and outfit pairing preview
```

---

### Task 14: GapSecondaryCard component

**Files:**
- Create: `src/components/gaps/GapSecondaryCard.tsx`

- [ ] **Step 1: Implement secondary gap card**

Compact card (~280px wide) for the horizontal scroll. Layout:

1. Item name (DM Sans, 15px, font-medium)
2. Category pill + color indicator dot
3. "+N outfits" with accent number
4. One-line reason (DM Sans, 13px, text-foreground/60)
5. **"Why this?" expandable:** tap to reveal `key_insight` in Playfair Display italic
6. "Find this" outline button

Props: `gap: GapResult`

- [ ] **Step 2: Typecheck + commit**

```
feat: add GapSecondaryCard for horizontal scroll layout
```

---

### Task 15: Rewrite GapResultsPanel

**Files:**
- Modify: `src/components/gaps/GapResultsPanel.tsx`

- [ ] **Step 1: Replace with hero + scroll layout**

New structure:
1. Header: result count + last-scanned timestamp + refresh button
2. `GapHeroCard` for `results[0]`
3. Horizontal scroll of `GapSecondaryCard` for `results.slice(1)`
4. Use `useGarmentsByIds` to resolve `pairing_garment_ids` from all gaps

Keep existing props interface. Add `garmentMap` resolution inside the component using the pairing IDs.

- [ ] **Step 2: Typecheck + commit**

```
feat: rewrite GapResultsPanel with hero card + horizontal scroll
```

---

### Task 16: Update wardrobe_gap_analysis edge function

**Files:**
- Modify: `supabase/functions/wardrobe_gap_analysis/index.ts`

- [ ] **Step 1: Better <5 garment handling**

Replace line 46-48:
```typescript
if (!garments || garments.length < 5) {
  return new Response(JSON.stringify({
    error: "minimum_garments",
    required: 5,
    current: garments?.length ?? 0,
  }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: Increase sample to 25 garments**

Change `.slice(0, 15)` to `.slice(0, 25)` in the wardrobe profile string.

- [ ] **Step 3: Add pairing garment IDs to AI prompt**

Add to the prompt:
```
For each gap, also return "pairing_garment_ids": an array of 2-3 garment IDs from the user's wardrobe that would pair best with the suggested item. Use actual garment IDs from the wardrobe listing.
Also return "key_insight": one sentence explaining the visual or style impact of adding this piece.
```

Update the JSON output format in the prompt to include the new fields.

- [ ] **Step 4: Typecheck + commit**

```
feat: wardrobe_gap_analysis — pairing IDs, larger sample, better errors
```

---

### Task 17: Wardrobe Gaps i18n keys

**Files:**
- Modify: `src/i18n/locales/en.ts` and `sv.ts`

- [ ] **Step 1: Append gaps keys**

```typescript
'gaps.hero_eyebrow': 'Your next best purchase',
'gaps.find_this': 'Find this',
'gaps.why_this': 'Why this?',
'gaps.new_outfits': 'new outfit combinations',
'gaps.no_gaps': 'Your wardrobe is well-balanced',
'gaps.min_garments': 'Add more garments for gap analysis',
```

Plus Swedish equivalents.

- [ ] **Step 2: Commit**

```
feat: add wardrobe gaps i18n keys (en + sv)
```

---

### Task 18: Integration verification

- [ ] **Step 1: Run all checks**

```bash
npx tsc --noEmit --skipLibCheck
npx eslint src/ --ext .ts,.tsx --max-warnings 0
npm run build
npx vitest run
```

- [ ] **Step 2: Create PR**

Branch from main. Push. Create PR with test plan.

---

## Dependency Graph

```
Phase A (Travel Capsule):
Task 1 (DB) → Task 3 (hook) → Task 7 (update useTravelCapsule) → Task 9 (wire page)
Task 2 (types) → Task 5 (Step1) + Task 6 (Step2) → Task 4 (Wizard) → Task 9
Task 10 (edge fn) — independent
Task 8 (history list) → Task 9
Task 11 (i18n) — independent

Phase B (Wardrobe Gaps):
Task 12 (types) → Task 13 (hero) + Task 14 (secondary) → Task 15 (panel) → Task 18
Task 16 (edge fn) — independent
Task 17 (i18n) — independent
```

Tasks within each phase can be parallelized where the graph allows. Phase B is fully independent of Phase A.
