

## Fix: PWA Icon Transparent Background

### Problem
The current PWA icons (`icon-192.png` and `icon-512.png`) were copied directly from `burs-logo.png`, which has a **transparent background**. When installed as a PWA on iOS/Android, the transparency renders as a black or checkered background instead of the brand off-white (#F6F4F1).

### Solution
Create a backend function that composites the B-hanger logo onto a solid #F6F4F1 off-white background with proper padding, generating proper 192x192 and 512x512 PWA icons. We'll use the Lovable AI image generation to create these icons with the correct solid background.

### Steps

1. **Generate new PWA icons** using the AI image editing API:
   - Take the existing `burs-logo.png` and place it on a solid #F6F4F1 background
   - Generate both 192x192 and 512x512 versions with generous padding (the icon centered with ~20% margin)
   - The result: charcoal (#111111) B-hanger mark on solid off-white (#F6F4F1), rounded corners optional since OS handles masking

2. **Replace the icon files**:
   - Overwrite `public/icons/icon-192.png`
   - Overwrite `public/icons/icon-512.png`

3. **Update manifest.json** to split `purpose` into separate entries (best practice for maskable icons to render correctly on all devices):
   - One entry with `"purpose": "any"` (standard icon)
   - One entry with `"purpose": "maskable"` (safe-zone cropped icon)

### Technical Details

- The `maskable` purpose requires the important content to be within the center 80% "safe zone" since OS may crop edges
- Splitting `"any maskable"` into two separate entries ensures the best rendering on all platforms
- The solid background eliminates the transparency issue on all devices

