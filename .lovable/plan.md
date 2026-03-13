

# Fix Mood Outfit Display Names

## Problem
Mood outfits are saved with `occasion: "mood:cozy"`, `"mood:confident"`, etc. When displayed, the app tries `t("occasion.mood:cozy")` which doesn't exist, so it falls back to the raw string `"mood:cozy"` — showing a weird, technical-looking name.

## Fix

### `src/pages/OutfitDetail.tsx` (~line 263)
Update the `displayOccasion` logic to detect `mood:` prefix and use the existing `ai.mood_X` translation keys instead:

```tsx
// Before
const occasionLabel = t(`occasion.${outfit.occasion.toLowerCase()}`);
const displayOccasion = occasionLabel.startsWith('occasion.') ? outfit.occasion : occasionLabel;

// After — detect mood: prefix and use ai.mood_X keys
const isMoodOccasion = outfit.occasion.startsWith('mood:');
const moodKey = isMoodOccasion ? outfit.occasion.replace('mood:', '') : null;
const occasionLabel = isMoodOccasion
  ? t(`ai.mood_${moodKey}`)
  : t(`occasion.${outfit.occasion.toLowerCase()}`);
const displayOccasion = occasionLabel.startsWith('occasion.') || occasionLabel.startsWith('ai.mood_')
  ? outfit.occasion
  : occasionLabel;
```

### All other files displaying `occasion` — same pattern applied:
- `src/components/home/OutfitsPreview.tsx` (line 63)
- `src/components/outfit/PlannedOutfitsList.tsx` (line 61)
- `src/components/plan/PlanningSheet.tsx` (line 91)
- `src/pages/Plan.tsx` (line 354)
- `src/pages/ShareOutfit.tsx` (line 159)

Each will get the same mood-aware occasion label helper — extracted as a small utility function to avoid duplication.

### New utility (add to existing file or inline)
```tsx
function getOccasionLabel(occasion: string, t: (key: string) => string): string {
  if (occasion.startsWith('mood:')) {
    const key = `ai.mood_${occasion.replace('mood:', '')}`;
    const label = t(key);
    return label.startsWith('ai.') ? occasion : label;
  }
  const label = t(`occasion.${occasion.toLowerCase()}`);
  return label.startsWith('occasion.') ? occasion : label;
}
```

### Files to edit
- `src/pages/OutfitDetail.tsx`
- `src/components/home/OutfitsPreview.tsx`
- `src/components/outfit/PlannedOutfitsList.tsx`
- `src/components/plan/PlanningSheet.tsx`
- `src/pages/Plan.tsx`
- `src/pages/ShareOutfit.tsx`

