

## Fix "How It Works" Step Number Alignment

### Problem
The large step numbers (01, 02, 03) are misaligned with their corresponding text content. As visible in the screenshot:
- "01" floats near the section title instead of next to step 1 content
- Numbers and text blocks don't share a consistent baseline or vertical center
- The `pt-2` offset on the text div creates uneven spacing

### Solution

**File: `src/pages/Landing.tsx` (lines 201-216)**

Restructure each step row so the number and text are properly vertically centered:

1. Change `items-start` to `items-center` on the flex container so numbers and text vertically center-align
2. Remove the `pt-2` hack from the text div since centering handles it
3. Give the number span a fixed width (`w-20 md:w-28`) so all three numbers create a consistent left column
4. Move the "01" number away from the section heading -- it currently appears above step 1's content area because the heading/divider section is separate. The fix ensures each number sits cleanly in its own row

The corrected layout per step:

```text
  |  01  |  [icon] Snap your clothes           |
  |      |  Description text here...            |
  |------|--------------------------------------|
  |  02  |  [icon] AI works its magic           |
  |      |  Description text here...            |
  |------|--------------------------------------|
  |  03  |  [icon] Wear & Care                  |
  |      |  Description text here...            |
```

### Technical Changes

- `items-start` becomes `items-center` on step flex containers
- Remove `pt-2` from the text `div`
- Add consistent `w-20 md:w-28` to the number `span` for uniform column width
- Adjust number font styling: keep `text-6xl md:text-7xl` but ensure `leading-none` and proper shrink behavior

This is a small, targeted fix -- only lines 206-214 in `Landing.tsx` change.

