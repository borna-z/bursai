

# Wardrobe + Live Scan -- Premium Redesign

Two pages rebuilt with the same "less is more" philosophy as the Today page: clean, minimal, interactive, and fast.

---

## Part 1: Wardrobe Page

### What changes

**Remove visual noise:**
- Drop the collapsible SettingsGroup wrappers for search and filters -- replace with a single clean search bar always visible at the top
- Remove the 4x2 category grid -- replace with a horizontal scroll row of category pills (like the occasion pills on Home)
- Remove the collapsible filter section -- move color and season into a slim filter row that appears only when tapped (a single "Filter" pill that opens an inline row, not a collapsible card)
- Remove the SettingsGroup borders around everything

**Simplify the header area:**
- Merge the garment count into the search bar placeholder (e.g., "Search 10 garments...")
- Keep grid/list toggle and select button in the PageHeader

**Streamline the tab switcher:**
- Keep garments/outfits segmented control but make it slimmer: `py-1.5` with `text-xs`

**Card refinements:**
- Grid cards: keep `aspect-[3/4]`, remove the text block below -- just show the image. Title appears as a subtle overlay at the bottom of the image (semi-transparent gradient)
- This makes the grid feel more like a fashion lookbook -- pure imagery
- List cards: keep as-is (already clean)

**FABs:**
- Combine the two FABs (scan + add) into a single FAB with a "+" icon. Long-press or tap opens a small menu with "Photo" and "Scan" options
- This reduces visual clutter at the bottom

### What stays the same
- All data fetching logic (useGarments, infinite scroll, virtualization)
- Swipeable cards in list view
- Bulk select mode
- Pull-to-refresh
- Outfits tab content

---

## Part 2: Live Scan -- Faster and More Fun

### Performance improvements (useLiveScan hook)
- Reduce image compression `maxDim` from 640 to 480 for faster upload
- Reduce JPEG quality from 0.7 to 0.5 -- the AI doesn't need high quality for classification
- These two changes alone cut the payload by ~50%, making the edge function response noticeably faster

### Auto-detect tuning (useAutoDetect hook)
- Reduce `STABLE_DURATION` from 400ms to 300ms -- fire faster when stable
- Reduce `COOLDOWN` from 500ms to 350ms -- re-arm faster for next scan
- Keep `DIFF_THRESHOLD` at 0.04 (already good)

### UI redesign -- cleaner, more premium
- **Remove the corner brackets** during scanning -- too busy. Replace with a single clean circular reticle in the center (thin white circle, 200px diameter) that pulses green when stable
- **Remove the laser sweep line** -- replace with a subtle radial pulse from center outward
- **Simplify the result card**: make it fullscreen-overlay style instead of a bottom card. Show the captured image large with the analysis overlaid as clean text. Two buttons below: Retake (ghost) and Accept (solid emerald)
- **Scan counter**: move from the top bar into a small floating pill at the bottom-left, showing just the number with a tiny checkmark icon
- **Auto mode toggle**: keep but simplify -- just a small icon toggle (Zap/ZapOff) without text label
- **Shutter button**: make it slightly smaller (w-16 h-16) and cleaner -- no inner circle, just a clean ring that fills with color when auto-progress advances
- **Remove the "slots remaining" bar** for free users -- handle it silently (show paywall when limit hit)

### Accepted overlay refinement
- Speed up from 600ms to 400ms -- keep the flow snappy
- Simplify animation: just a clean checkmark fade-in without the ring drawing animation

---

## Technical Details

### Files to modify:
1. `src/pages/Wardrobe.tsx` -- Simplified layout, horizontal category pills, overlay titles on grid cards, single FAB
2. `src/pages/LiveScan.tsx` -- Cleaner overlays, fullscreen result card, simplified scan UI
3. `src/hooks/useLiveScan.ts` -- Reduce maxDim to 480, quality to 0.5
4. `src/hooks/useAutoDetect.ts` -- Reduce STABLE_DURATION to 300ms, COOLDOWN to 350ms

### No new files needed.
### No new dependencies.
### No database changes.

### Risk: Low
- Wardrobe: only layout/presentation changes, all data logic unchanged
- LiveScan: compression changes are safe (AI handles lower quality fine), timing changes are minor tweaks
- No breaking changes to any shared components

