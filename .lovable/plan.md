

# Premium AI Loading States — Design Plan

## Current State Assessment

The app uses two shared loading components everywhere:
- **`AILoadingOverlay`** — fullscreen/inline/card with bouncing dots + pulse rings + rotating phase labels
- **`AILoadingCard`** — compact horizontal variant with same bouncing dots + pulse rings

Both feel identical regardless of context. The bouncing dots and radar pulse rings read as generic "AI spinner" rather than premium editorial. Every AI surface uses the same visual language, violating the principle that different actions need different loading states.

### Specific Issues Found
1. **Outfit generation** (`OutfitGenerate.tsx`): Fullscreen AILoadingOverlay blanks the entire page
2. **Swap loading** (`OutfitDetail.tsx` SwapSheet): Raw `Loader2 animate-spin` spinner — the cheapest pattern in the app
3. **Stylist chat** (`AIChat.tsx`): Bouncing dots + "Thinking..." — generic chatbot feel
4. **Garment analysis** (`AddGarment.tsx`): AILoadingOverlay inline with shimmer sweep — decent but uses same pulse rings
5. **Mood outfit** (`MoodOutfit.tsx`): AILoadingCard cramped inside a small card — no mood expression
6. **Travel capsule** (`TravelCapsule.tsx`): AILoadingOverlay card variant with progress bar — functional but same visual
7. **Style picker** (`StylePicker.tsx`): AILoadingCard squeezed into tiny grid cells
8. **TodayOutfitCard**: AILoadingCard — same as everywhere else
9. **UnusedOutfits**: AILoadingOverlay inline with skeleton cards — acceptable but generic

---

## Plan

### A. Redesign shared foundation components

#### 1. Replace `AILoadingOverlay` internals — refine, don't rebuild

**File: `src/components/ui/AILoadingOverlay.tsx`**
- Remove bouncing dots (`BouncingDots` component) — replace with a single subtle horizontal shimmer line (a thin `h-px` element with a CSS shimmer animation using existing `animate-shimmer-sweep` or a simple opacity wash)
- Replace `PulseRings` (concentric expanding circles) with a quieter treatment: a single soft breathing glow behind the icon (opacity oscillation 0.3→0.6, no scale change), respecting `prefers-reduced-motion`
- Keep the phase text crossfade — it's already clean
- Keep the progress bar option — it works for travel capsule
- Add a new `tone` prop: `'neutral' | 'warm' | 'expressive'` that subtly shifts the icon background tint (neutral = current, warm = amber-tinted for editorial warmth, expressive = mood-colored)
- Add reduced-motion: all animated elements get `useReducedMotion()` guard

#### 2. Replace `AILoadingCard` internals

**File: `src/components/ui/AILoadingCard.tsx`**
- Remove bouncing dots, replace with the same shimmer line
- Remove pulse rings, replace with the breathing glow
- Keep the compact horizontal layout — it's appropriate for inline contexts

#### 3. Create purpose-specific wrapper components

These are thin wrappers that configure the shared foundation with context-appropriate phases, copy, and layout.

**File: `src/components/ui/OutfitGenerationState.tsx`** (new)
- Shows 4 outfit slot placeholders (top/bottom/shoes/accessory) as soft rounded-lg skeleton rectangles in a 2×2 grid
- Below: uses `AILoadingCard` with refined phases and editorial copy:
  - "Selecting pieces" / "Balancing the look" / "Refining your outfit"
- Wraps in a card container matching existing `rounded-2xl bg-foreground/[0.02] border border-border/30` style
- On completion: slots crossfade into actual garment thumbnails via `FadeReplace`

**File: `src/components/ui/StylistReplyPlaceholder.tsx`** (new)
- A refined assistant message shell: left-aligned, matches chat bubble width
- Shows 3 shimmer lines (different widths: 80%, 60%, 45%) that pulse with a subtle opacity wash
- Below the lines: a quiet "Preparing your note" label in `text-[11px] text-muted-foreground/40`
- No bouncing dots, no "Thinking..." — just composed stillness
- Crossfades into actual message content when response arrives

**File: `src/components/ui/SwapLoadingState.tsx`** (new)
- A compact loading treatment for the swap sheet: replaces the `Loader2 animate-spin`
- Shows 3 skeleton garment rows (matching the candidate row layout: 64px square + two text lines)
- Above: a single line "Finding the best match" in `text-xs text-muted-foreground`
- Subtle shimmer across the skeleton rows

#### 4. Create `GarmentAnalysisState.tsx` (new)
- Wraps the existing image preview with a refined overlay
- Instead of the generic AILoadingOverlay, shows a thin progress rail along the bottom of the image
- Phase labels appear below the image as quiet editorial text, not inside a loading card
- Steps: "Detecting garment" → "Extracting color and material" → "Refining details"

### B. Apply purpose-specific states to each surface

#### 5. Outfit generation (`OutfitGenerate.tsx`)
- Replace fullscreen `AILoadingOverlay` with `OutfitGenerationState` centered in the page
- Keep `AppLayout` frame stable — no blank screen
- Subtitle (occasion · style · temperature) stays

#### 6. TodayOutfitCard (`src/components/home/TodayOutfitCard.tsx`)
- Replace `AILoadingCard` with a mini version of `OutfitGenerationState` (2×2 skeleton grid + single phase label)
- Copy: "Building today's look"

#### 7. Style picker (`StylePicker.tsx`)
- When generating, replace the entire grid with a centered `OutfitGenerationState` card (not squeezed into a tiny cell)
- Keep the page header stable

#### 8. Mood outfit (`MoodOutfit.tsx`)
- When generating, show `OutfitGenerationState` with `tone="expressive"` below the selected mood card
- Copy: "Composing your mood look" / "Shaping the outfit"
- Selected mood card gets a subtle `ring-2 ring-primary` highlight (already exists)

#### 9. Swap sheet (`OutfitDetail.tsx` SwapSheet)
- Replace `Loader2 animate-spin` with `SwapLoadingState`
- Copy: "Finding the best swap"

#### 10. Stylist chat (`AIChat.tsx`)
- Replace the bouncing dots + "Thinking..." block with `StylistReplyPlaceholder`
- Crossfade into actual streamed content

#### 11. Garment analysis (`AddGarment.tsx`)
- Replace `AILoadingOverlay` inline usage with `GarmentAnalysisState`
- Keep the image preview visible and prominent
- Phase labels below image, not in a centered overlay

#### 12. Travel capsule (`TravelCapsule.tsx`)
- Keep the existing `AILoadingOverlay variant="card"` with progress bar — it's appropriate for 60s generation
- Refine copy: "Analysing weather" → "Checking the forecast" / "Curating your capsule" / "Assembling outfits"
- The progress bar benefits from the shimmer line replacement

#### 13. Unused outfits (`UnusedOutfits.tsx`)
- Keep AILoadingOverlay inline with skeletons — refine copy only
- "Scanning your wardrobe" / "Creating combinations" / "Assembling looks"

### C. Motion refinements

- All new components use `useReducedMotion()` from framer-motion
- Shimmer line: CSS keyframe `@keyframes shimmer-wash` — a single pass opacity gradient, `2.5s infinite`
- Breathing glow: `opacity: [0.3, 0.6, 0.3]` over `3s`, no scale
- Skeleton rows: staggered fade-in with `STAGGER_DELAY` from motion tokens
- Result replacement: use `FadeReplace` for all loading→content transitions

### D. i18n — add all new copy keys

**File: `src/i18n/translations.ts`**
Add keys for both `en` and `sv`:
- `ai.selecting_pieces` / `ai.balancing_look` / `ai.refining_outfit`
- `ai.preparing_note` / `ai.finding_swap` / `ai.composing_mood`
- `ai.checking_forecast` / `ai.curating_capsule` / `ai.assembling_outfits`
- `ai.building_todays_look` / `ai.detecting_garment` / `ai.extracting_details` / `ai.refining_details`

### E. Files summary

**New files (4):**
- `src/components/ui/OutfitGenerationState.tsx`
- `src/components/ui/StylistReplyPlaceholder.tsx`
- `src/components/ui/SwapLoadingState.tsx`
- `src/components/ui/GarmentAnalysisState.tsx`

**Modified files (~12):**
- `src/components/ui/AILoadingOverlay.tsx` — refined internals
- `src/components/ui/AILoadingCard.tsx` — refined internals
- `src/pages/OutfitGenerate.tsx` — use OutfitGenerationState
- `src/components/home/TodayOutfitCard.tsx` — use mini OutfitGenerationState
- `src/pages/StylePicker.tsx` — centered generation state
- `src/pages/MoodOutfit.tsx` — expressive generation state
- `src/pages/OutfitDetail.tsx` — SwapLoadingState in sheet
- `src/pages/AIChat.tsx` — StylistReplyPlaceholder
- `src/pages/AddGarment.tsx` — GarmentAnalysisState
- `src/pages/TravelCapsule.tsx` — refined copy
- `src/pages/UnusedOutfits.tsx` — refined copy
- `src/i18n/translations.ts` — new keys

