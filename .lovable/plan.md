

## Remove "Import from Link" from Wardrobe FAB Menu

### Change
In `src/pages/Wardrobe.tsx`, remove the "Import from Link" menu item from the `AddFAB` component, keeping only:
1. **BURS Live Scan** (ScanLine icon)
2. **Add** (Camera icon)

Update the `menuItems` array to exclude the link import entry and adjust stagger indices accordingly.

### Files to Edit
1. **`src/pages/Wardrobe.tsx`** — Remove the link import item from the `menuItems` array in `AddFAB`

