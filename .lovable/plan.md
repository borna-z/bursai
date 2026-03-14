

# Update How It Works Screenshots

## What changes
Copy 3 new uploaded screenshots into `public/images/` and update the `tabSrcs` mapping in `public/landing.html`. The "today" tab keeps its current image.

## Files

### New assets (copy from uploads)
- `user-uploads://image-38.png` → `public/images/screenshot-wardrobe.png` (replaces existing — scan tab)
- `user-uploads://image-39.png` → `public/images/screenshot-planner.png` (replaces existing — plan tab)
- `user-uploads://image-40.png` → `public/images/screenshot-stylist.png` (replaces existing — chat tab)
- `user-uploads://Image_25.jpg` → `public/images/screenshot-travel.png` (new — travel tab)

### `public/landing.html` (~line 805-811)
Update the `tabSrcs` object to point `travel` to the new dedicated travel screenshot:

```javascript
const tabSrcs={
  scan:"/images/screenshot-wardrobe.png",
  today:"/images/screenshot-today.png",
  plan:"/images/screenshot-planner.png",
  chat:"/images/screenshot-stylist.png",
  travel:"/images/screenshot-travel.png"
};
```

No other changes needed — the tab switcher logic and default `<img>` tag remain the same.

