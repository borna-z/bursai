

# Plan: Fix Capsule Loading, Raise Outfit Cap, Support Multiple Outfits Per Day

## 1. Fix loading phases in TravelCapsule

**File: `src/pages/TravelCapsule.tsx`**

Replace the 9 `travelLoadingPhases` (lines 147-157) with 4 phases matching user's spec:
- 0–10s: "Analysing the weather" (Cloud icon, duration 10000)
- 10–20s: "Analysing the wardrobe" (Shirt icon, duration 10000)
- 20–40s: "Styling the outfits" (SlidersHorizontal icon, duration 20000)
- 40–60s: "Creating the packing" (Package icon, duration 0 — holds until done)

Update the simulated progress duration (line 164) to stay at 60000ms — no change needed there, it already matches.

## 2. Raise max outfits to 35

**File: `supabase/functions/travel_capsule/index.ts`**

Change `const targetOutfits = Math.min(duration_days * outfitsPerDay, 20)` → cap at **35**.
Change `const maxItems = Math.min(Math.ceil(duration_days * 2.5), 25)` → cap at **30** (more items needed for 35 outfits).

## 3. Allow multiple outfits per day in planner (max 4)

This requires a database migration + code changes.

### 3a. Database migration
Drop the `UNIQUE(user_id, date)` constraint on `planned_outfits`. Add a new unique constraint on `(user_id, date, outfit_id)` to prevent duplicate assignments of the same outfit to the same day.

### 3b. `src/hooks/usePlannedOutfits.ts`
- `usePlannedOutfits`: Change `getPlannedForDate` to return an **array** instead of a single item.
- `useUpsertPlannedOutfit`: Replace `.upsert(..., { onConflict: 'user_id,date' })` with a plain `.insert(...)` since we now allow multiple per day. Add a count check (max 4) before inserting.
- `usePlannedOutfitForDate`: Return array instead of single.

### 3c. `src/pages/Plan.tsx`
- `plannedOutfit` → `plannedOutfitsForDay` (array)
- Show all outfits for the selected day (grid of outfit cards, max 4)
- "Generate" button disabled when day has 4 outfits
- Each outfit card gets its own swap/remove/mark-worn actions
- WeekStrip dot indicator: show multiple dots or a count badge for days with >1 outfit

### 3d. `src/pages/TravelCapsule.tsx` — `handleAddToCalendar`
- Remove `onConflict: 'user_id,date'` from the planned_outfits upsert → use plain `.insert()`
- This naturally supports multiple capsule outfits per day

### 3e. `src/components/plan/WeekStrip.tsx`
- Update the planned indicator to show count when >1 outfit exists for a day

---

## Summary
- **4 files edited**: `TravelCapsule.tsx`, `usePlannedOutfits.ts`, `Plan.tsx`, `WeekStrip.tsx`
- **1 edge function**: `travel_capsule/index.ts` (raise cap)
- **1 migration**: Drop unique constraint, add new composite unique

