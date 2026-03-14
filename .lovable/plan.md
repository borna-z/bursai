

# Move Wardrobe Gap Analysis & Mood Outfit to Home Page

## Changes

### 1. `src/pages/Home.tsx`
- Import `WardrobeGapSection` and add the Mood Outfit inline card
- Place both after `QuickActionsRow`, before the closing `</AnimatedPage>`
- Copy the Mood Outfit button markup from Discover (the `Heart` icon card that navigates to `/ai/mood-outfit`)

### 2. `src/pages/Discover.tsx`
- Remove the `WardrobeGapSection` import and rendering (lines 16, 111-112)
- Remove the Mood Outfit inline card block (lines 114-134)
- Remove unused imports: `Heart`, `hapticLight`, `useNavigate` (if no longer needed), `WardrobeGapSection`

### Result
- Discover page keeps only the header + Style Challenges
- Home page gains the gap analysis scanner and mood outfit card below quick actions

