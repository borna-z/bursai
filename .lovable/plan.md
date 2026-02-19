

# Redesign Wardrobe + Update Plan Buttons

## Wardrobe -- Full Minimal Redesign

Replace the current busy layout (scrolling chip bar, search bar + filter icon, badges, alerts) with a clean, card-based design matching the Today page.

### New layout (top to bottom):

1. **PageHeader** -- "Garderob" title with grid/list toggle and select button (keep as-is)

2. **Search row** -- Clean search input inside a `SettingsGroup` card (expandable, tap to open), no separate filter icon button

3. **Category selector** -- Replace the horizontal scrolling chip bar with a `SettingsGroup` card containing a **grid layout** (like Today's occasion grid). Categories displayed as tappable cells in a 4x2 grid with subtle borders between them. Selected category gets accent highlight.

4. **Filter row** -- Sort, color, season filters inside a collapsible `SettingsGroup` card (tap "Filters" row to expand/collapse), replacing the bottom sheet. Clean inline approach.

5. **Garment count** -- Small muted text showing "12 plagg" count, no alerts or banners for limits (paywall triggers on action instead)

6. **Garment grid** -- Keep the 2-column grid but simplify cards: remove hover overlays, remove badges. Just image + title + subtitle. Cleaner rounded-xl cards.

7. **FABs** -- Keep the floating action buttons (scan + add) but style them to match Today's button aesthetic (rounded-xl, same shadow style)

8. **Bulk select bar** -- When selecting, show a minimal bottom bar (keep existing logic, just cleaner styling)

### What gets removed:
- Horizontal scrolling chip bar for categories
- Bottom sheet for filters (replaced with inline collapsible)
- "New garments" alert card
- QuickEditPanel banner
- Over-limit alert banner (paywall still triggers on action)
- Hover-reveal laundry buttons on cards

### Plan Page -- Button Style Update

Keep the entire Plan page layout as-is. Only update button styling to match Today:
- "Planera" and "Skapa at mig" buttons: use rounded-xl, same font weight
- "Byt" and "Detaljer" buttons: match the outline style from Today
- Secondary text links (mark as worn, remove): keep minimal

## Technical Details

| File | Change |
|------|--------|
| `src/pages/Wardrobe.tsx` | Full rewrite -- replace chip bar with SettingsGroup grid, inline collapsible filters, simplified garment cards, remove alerts/banners |
| `src/pages/Plan.tsx` | Update button classNames to use rounded-xl and match Today's accent styling |

No new files needed. The `SettingsGroup` component is already imported in Today and works perfectly for this pattern.

