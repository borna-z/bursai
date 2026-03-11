

## Plan: Simplify Outfit Detail Screen

### Changes

**`src/pages/OutfitDetail.tsx`**

1. **Remove Flat-Lay section** (lines 412-466) — delete entirely, including the `generateFlatlay` hook import and `isGeneratingFlatlay` variable

2. **Remove Outfit DNA section** (line 597) — delete `<OutfitDNASection>` usage

3. **Remove Accessories section** (line 600) — delete `<AccessoryPairingSection>` usage

4. **Remove unused imports**: `ImageIcon` from lucide, `useGenerateFlatlay` hook, `OutfitDNASection`/`AccessoryPairingSection` from AdvancedOutfitFeatures

5. **Compact Mirror Check section** (lines 468-578) — replace the large empty placeholder (the dashed box with oversized camera icon and padding `p-8`) with a compact single-row upload prompt: a small rounded bar with camera icon + text + upload button, roughly 48px tall instead of the current ~120px empty box

### Section order after changes:
- Hero image grid
- Title + meta
- AI explanation ("Why this works")
- Style Score (kept, only renders when data exists)
- Garment list with swap buttons
- Mirror Check (compact)
- Rating stars
- Feedback chips
- Mark as worn CTA + Plan/Similar buttons

