
# Implementation Plan

## 1. Add Count Badges to Smart Filter Chips
**File:** `src/pages/Wardrobe.tsx`
- We will add a `useMemo` hook to pre-calculate the counts for the three smart filters based on `allGarments`:
  - `rarely_worn`: Garments not worn in the last 30 days.
  - `most_worn`: Garments with `wear_count > 0`.
  - `new`: All garments (since this filter sorts the full list by newest).
- In the smart filter chip rendering loop (around line 575), we will append the pre-calculated count inside the `Chip` component so it renders dynamically next to the label (e.g., `Rarely worn (5)`).

## 2. Implement Blur-Up Placeholder Thumbnails
**File:** `src/hooks/useSignedUrlCache.ts`
- Update the `CacheEntry` interface to include a `placeholderUrl`.
- Modify `getCachedSignedUrl` to fetch **two** signed URLs via Supabase Storage `transform` options:
  - **Main URL**: `transform: { width: 600, quality: 85 }` (Ensures the main grid image loads much faster than the raw file).
  - **Placeholder URL**: `transform: { width: 50, quality: 20 }` (Generates a tiny thumbnail payload).
- Update the `useCachedSignedUrl` hook to return `placeholderUrl` alongside the main `signedUrl`.

**File:** `src/components/ui/lazy-image.tsx`
- Update `LazyImage` and `LazyImageSimple` to extract `placeholderUrl` from the hook.
- Render the placeholder `img` directly behind the main image with Tailwind classes like `absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50`.
- The main image will sit on top with `opacity-0` and seamlessly transition to `opacity-100` when its `onLoad` event fires, achieving a premium blur-up loading experience.
