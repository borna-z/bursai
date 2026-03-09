

# Fix: Remove Image Zoom/Crop from Main Signed URLs

## Problem
The `transform: { width: 600, quality: 85 }` added to the main signed URL request is causing Supabase Storage to resize/crop garment images, making them appear zoomed in.

## Fix
**File:** `src/hooks/useSignedUrlCache.ts`

- Remove the `transform` option from the **main** signed URL request so it returns the original image.
- Keep the tiny placeholder transform (`width: 50, quality: 20`) for the blur-up effect — that one is intentional and invisible at full size.

This is a one-line change in `getCachedSignedUrl`: revert the main `createSignedUrl` call to not use any transform options.

