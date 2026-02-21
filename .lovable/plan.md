

## Fix Wardrobe Editing, Deleting, and Name Change Flow

### Problems Found

1. **Cannot edit garment name (error on click)**: The edit button on the Garment Detail page navigates to `/wardrobe/:id/edit`, but this route does **not exist** in the app router. It results in a 404 page.

2. **Cannot delete a single garment**: The delete button on the Garment Detail page uses an `AlertDialog` which should work. The issue may be related to event propagation or the dialog not rendering properly. This will be verified and fixed.

3. **Cannot delete multiple garments in select mode**: The bulk delete code looks correct but may silently fail. Will add better error handling.

### Solution

#### 1. Create a new Edit Garment page (`src/pages/EditGarment.tsx`)
- A new page that loads the existing garment data and presents an editable form (title, category, subcategory, color, pattern, material, fit, season tags, formality).
- Reuses the same form layout and constants from `AddGarment.tsx` but pre-fills all fields from the existing garment.
- Uses `useGarment(id)` to load data and `useUpdateGarment()` to save changes.
- Includes a save button that updates the garment and navigates back.

#### 2. Register the edit route in `src/App.tsx`
- Add route: `/wardrobe/:id/edit` pointing to the new `EditGarment` component, wrapped in `ProtectedRoute`.

#### 3. Fix delete flow on Garment Detail page
- Verify the `AlertDialog` works correctly and ensure the delete confirmation button triggers `handleDelete` properly.
- Add a confirmation dialog for single-item deletion from the wardrobe select mode as well.

#### 4. Improve bulk delete reliability
- Add better error feedback in `handleBulkDelete` on `Wardrobe.tsx` so failures are visible.

### Technical Details

**New file: `src/pages/EditGarment.tsx`**
- Loads garment via `useGarment(id)` hook
- Pre-fills form state with garment's current values (title, category, color, etc.)
- Save button calls `useUpdateGarment().mutateAsync({ id, updates })` and navigates back to `/wardrobe/:id`
- Uses same category/color/pattern/material/fit/season constants from `AddGarment.tsx`

**Route addition in `src/App.tsx`:**
```text
/wardrobe/:id/edit -> <ProtectedRoute><EditGarment /></ProtectedRoute>
```

**Translation keys to add:**
- `garment.edit_title` -- "Edit garment" / "Redigera plagg"
- `garment.save` -- "Save" / "Spara"

### Files to Create/Modify
1. **Create** `src/pages/EditGarment.tsx` -- full garment edit form
2. **Modify** `src/App.tsx` -- add the edit route
3. **Modify** `src/i18n/translations.ts` -- add edit-related translation keys

