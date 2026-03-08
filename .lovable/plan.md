

## Redesign Smart Groupings and Clean Up Wardrobe Filters

### Current Issues
- Smart groupings are plain horizontal scrolls with generic section headers — they don't feel interactive or filterable
- The three groupings (rarely worn, most worn, recently added) take up a lot of vertical space before the user sees their actual wardrobe grid
- No way to quickly tap a grouping as a filter — they're browse-only

### Design

**1. Replace Smart Groupings with tappable filter chips**
- Convert "Rarely worn", "Most worn", "Recently added" into a horizontal row of tappable pill buttons at the top (below search bar)
- Tapping one filters the grid to show only those garments — no separate horizontal scroll sections
- Active chip gets accent styling, tapping again deselects and shows all
- This removes ~3 scroll sections and makes the page much shorter and cleaner

**2. Simplify SmartGroupings component**
- Remove the `SmartGroupings` component entirely from the wardrobe page
- Move the logic (rarely worn = not worn in 30 days, most worn = sorted by wear_count, recently added = sorted by created_at) into the Wardrobe page as a "smart filter" state
- When a smart filter is active, it overrides the sort/filter to show the relevant subset

**3. Clean up the wardrobe header area**
- Smart filter chips sit in a single horizontal scroll row between search bar and the grid
- Chips: "Rarely worn", "Most worn", "New" (shorter label), plus the existing filter icon stays
- Keep the filter sheet for advanced filtering (color, season, sort, laundry)

### Files to Change
- `src/pages/Wardrobe.tsx` — add smart filter chips row, remove SmartGroupings import, add smart filter logic
- `src/components/wardrobe/SmartGroupings.tsx` — can be deleted or kept unused

