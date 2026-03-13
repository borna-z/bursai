

# Fix: Load All Garments in Must-Have Picker

## Problem
`PickMustHaves.tsx` uses `useFlatGarments()` which is backed by `useInfiniteQuery` with a page size of 30. Only the first page loads, so users only see 30 garments.

## Solution
Create a dedicated query in `PickMustHaves.tsx` that fetches **all** garments in a single request (no pagination), or auto-fetch all pages on mount.

### `src/pages/PickMustHaves.tsx`
- Replace `useFlatGarments()` with a simple `useQuery` that fetches all garments at once (`supabase.from('garments').select('*').eq('user_id', user.id).order('created_at', { ascending: false })`) — bypassing the 30-item pagination entirely.
- Import `useAuth` and `useQuery` directly, query all garments without `.range()`.

This is a single-file change — just swap the data-fetching hook for one that doesn't paginate.

