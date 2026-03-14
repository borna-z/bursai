

# 35-Step AI Loading Animations Plan

Every AI-powered interaction gets a rich, multi-phase loading animation that explains what's happening — keeping users engaged and informed. The pattern: a shared `<AILoadingOverlay>` component with configurable phases (icon + label), pulsing visuals, and progress indicators.

---

## Architecture

**Step 1 — Create shared `AILoadingOverlay` component**
New file: `src/components/ui/AILoadingOverlay.tsx`
A reusable loading animation component with:
- Configurable `phases: { icon: LucideIcon, label: string, duration: number }[]`
- Auto-cycling through phases on a timer
- Radar pulse rings (from WardrobeGapSection pattern)
- Rotating phase icon with scale-in transition
- Bouncing dots indicator
- AnimatePresence for smooth phase text transitions
- Progress bar (optional, for determinate flows)
- Optional `subtitle` prop for context (occasion, mood, destination)
- `variant` prop: `'fullscreen' | 'inline' | 'card'`

**Step 2 — Create shared `AILoadingCard` component**
New file: `src/components/ui/AILoadingCard.tsx`
A smaller inline variant for within-page loading (cards, sections). Uses the same phase cycling but in a compact bordered card layout with skeleton placeholders below.

---

## Phase 1: Outfit Generation Surfaces (Steps 3-10)

**Step 3 — Upgrade `OutfitGenerate` page**
Replace the current basic ping/spin animation with `<AILoadingOverlay variant="fullscreen">` using 5 phases: Scanning wardrobe → Analyzing colors → Checking weather → Matching styles → Creating outfit.

**Step 4 — Upgrade `TodayOutfitCard` loading state**
Replace the 4-skeleton grid with `<AILoadingCard>` showing: Picking garments → Styling outfit → Finalizing. Add the context subtitle (occasion name).

**Step 5 — Upgrade `TodayOutfitCard` regeneration overlay**
Replace the static `Sparkles animate-pulse` shimmer with a mini `<AILoadingOverlay variant="inline">` overlay: Shuffling → Restyling.

**Step 6 — Upgrade `StylePicker` loading state**
When `isActive` on a style card, replace the `Badge animate-pulse` with a mini radar animation inside the card + phase text: Styling {look} → Matching garments.

**Step 7 — Upgrade `MoodOutfit` loading state**
Replace `Badge animate-pulse` + `loadingPhase` text with `<AILoadingCard>` embedded in the selected mood card: Feeling the mood → Matching colors → Building outfit.

**Step 8 — Upgrade `QuickGenerateSheet` loading state**
Replace `Loader2 animate-spin` button with the full button area showing a mini progress animation: Analyzing → Generating → Saving.

**Step 9 — Upgrade `QuickPlanSheet` loading state**
Replace `Loader2 + Progress` with `<AILoadingOverlay variant="inline">` showing current day name as subtitle + phase: Planning {dayName} → Checking weather → Selecting outfit. Keep the numeric progress bar below.

**Step 10 — Upgrade `UnusedOutfits` loading state**
Replace `Sparkles animate-pulse` + skeleton grid with `<AILoadingOverlay variant="inline">` above skeleton grid: Scanning unused garments → Creating combinations → Outfit {n}/6.

---

## Phase 2: Garment Analysis Surfaces (Steps 11-16)

**Step 11 — Upgrade `AddGarment` analyzing step**
Enhance the existing 4-phase stepper with radar pulse rings around the image preview + bouncing dots. Add a subtle shimmer sweep across the image.

**Step 12 — Add image shimmer effect to AddGarment**
Create a CSS keyframe `shimmer-sweep` — a diagonal gradient that sweeps across the garment image during analysis, like a scanner beam.

**Step 13 — Upgrade `BatchUploadProgress` per-item overlay**
Replace the simple spinner overlays with mini phase indicators per item: Uploading → Analyzing → Saving, with a tiny progress ring around each thumbnail.

**Step 14 — Upgrade `LiveScan` ScanOverlay**
Enhance the existing radial pulse with phase text cycling: Detecting garment → Analyzing details → Identifying.

**Step 15 — Upgrade duplicate detection loading**
When `checkDuplicates` runs after analysis, show a brief inline animation: Checking for duplicates → Comparing wardrobe.

**Step 16 — Add re-analyze animation on EditGarment**
When "Reanalyze" is clicked on the form page, show the shimmer sweep over the image + phase text: Re-scanning → Updating details.

---

## Phase 3: AI Chat & Stylist Surfaces (Steps 17-20)

**Step 17 — Upgrade AI Chat streaming indicator**
Replace the existing typing indicator with animated bouncing dots + phase text: Thinking → Styling suggestions → Writing response.

**Step 18 — Upgrade AI Chat image upload loading**
When `isUploading` is true, show a mini card with: Uploading image → Processing.

**Step 19 — Upgrade AI Chat "Try Outfit" action loading**
When creating an outfit from chat suggestions, show an inline `<AILoadingCard>`: Creating outfit → Saving.

**Step 20 — Upgrade ChatWelcome suggestion chips**
Add a subtle pulse animation to suggestion chips when AI is processing a related query.

---

## Phase 4: Insights & Reports (Steps 21-25)

**Step 21 — Upgrade `AISuggestions` LoadingIndicator**
Replace the current Wand2+Loader2 with `<AILoadingOverlay variant="card">` using 5 phases (keep existing text but add radar rings + bouncing dots).

**Step 22 — Upgrade `StyleReportCard` loading**
Replace `Loader2 animate-spin` button with `<AILoadingCard>`: Analyzing wardrobe → Computing scores → Writing report.

**Step 23 — Upgrade `WardrobeGapSection` — already has animation**
Standardize to use the shared `<AILoadingOverlay>` component for consistency (same visual, refactored code).

**Step 24 — Add loading animation to `CategoryRadar` data fetch**
Show a mini radar pulse while category data loads.

**Step 25 — Add loading animation to `WearHeatmap` data fetch**
Show a shimmer skeleton with phase text: Loading wear data → Building heatmap.

---

## Phase 5: Travel & Planning (Steps 26-29)

**Step 26 — Upgrade `TravelCapsule` generation loading**
Replace `loadingPhase` text with `<AILoadingOverlay variant="fullscreen">`: Checking weather → Analyzing wardrobe → Planning outfits → Optimizing packing → Creating capsule.

**Step 27 — Add weather lookup animation in TravelCapsule**
When `isFetchingWeather`, show a mini `<AILoadingCard>`: Looking up {destination} → Fetching forecast.

**Step 28 — Upgrade `TravelCapsule` "Add to Calendar" loading**
Replace the simple `isAddingToCalendar` spinner with: Saving outfits → Planning days → Syncing calendar.

**Step 29 — Add animation to `QuickGenerateSheet` travel weather lookup**
When `isFetchingTravel`, enhance the `Loader2` with a mini weather-themed animation.

---

## Phase 6: Advanced AI Features (Steps 30-33)

**Step 30 — Add loading animation to Outfit DNA Clone**
When `useCloneOutfitDNA` is pending, show `<AILoadingCard>`: Analyzing DNA → Finding variations.

**Step 31 — Add loading animation to Accessory Suggestions**
When `useSuggestAccessories` is pending: Scanning outfit → Matching accessories.

**Step 32 — Add loading animation to Condition Assessment**
When `useAssessCondition` is pending: Inspecting garment → Checking wear patterns.

**Step 33 — Add loading animation to Photo Feedback (OutfitDetail)**
Replace `Loader2 animate-spin` in `submitFeedback.isPending` with `<AILoadingCard>`: Analyzing photo → Scoring fit → Writing feedback.

---

## Phase 7: Polish & Consistency (Steps 34-35)

**Step 34 — Add CSS shimmer keyframe globally**
Add `@keyframes shimmer-sweep` to `index.css` — a diagonal light sweep animation reusable anywhere via `animate-shimmer` class.

**Step 35 — Standardize all existing loading spinners**
Audit all remaining `Loader2 animate-spin` instances in AI contexts and replace with the appropriate `AILoadingOverlay` or `AILoadingCard` variant for visual consistency.

---

## Component API Summary

```text
<AILoadingOverlay
  variant="fullscreen" | "inline" | "card"
  phases={[{ icon, label, duration }]}
  subtitle="Casual · Minimal"
  progress={0-100}           // optional determinate bar
  showSkeletons={3}          // optional skeleton cards below
/>

<AILoadingCard
  phases={[{ icon, label, duration }]}
  subtitle="..."
/>
```

Both components use:
- Concentric pulse rings (from WardrobeGap pattern)
- AnimatePresence phase text cycling
- Bouncing dots
- Icon scale-in transitions via framer-motion
- Theme-aware colors (`text-primary`, `bg-primary/10`)

