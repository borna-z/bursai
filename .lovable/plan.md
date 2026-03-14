

## Update OG Image

Replace the current `public/og-image.png` with the uploaded image. Update any references if dimensions change.

### Steps

1. Copy `user-uploads://image-30.png` to `public/og-image.png` (overwrite existing)
2. Verify `index.html` and `public/landing.html` both reference `/og-image.png` with correct dimensions (the uploaded image appears to be ~1500x780, close to the standard 1200x630 — keep existing meta width/height tags as-is since platforms resize automatically)

Single file copy, no code changes needed beyond the asset replacement.

