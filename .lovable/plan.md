

# Fix: Style Picker generates outfit but shows blank white page

## Root Cause Analysis

The backend is **working correctly** — the edge function returns HTTP 200 in ~4 seconds, and outfits + outfit items are being saved to the database. The issue is in the **post-generation client-side flow**.

After tracing the code path, I've identified three compounding problems:

### Problem 1: `invokeEdgeFunction` double-serializes the body
```typescript
// edgeFunctionClient.ts line 40
body: body ? JSON.stringify(body) : undefined,
```
The Supabase JS client's `functions.invoke()` already JSON-stringifies object bodies. By pre-stringifying, the edge function receives a JSON string *of a JSON string*. The edge function's `req.json()` parses it once, getting back... a string. Then `data.items` is `undefined`, causing "AI returned no garments" error. **However**, the error should be caught — except for Problem 2.

### Problem 2: `mutateAsync` error handling race condition
When `generateOutfitViaEngine` throws inside `useMutation.mutationFn`, the error propagates through `mutateAsync`. But `setIsGenerating(false)` runs in `finally` **before** the error reaches StylePicker's catch block. This creates a brief render cycle where:
- `isGenerating` = false, `selectedKey` = still set, `errorMessage` = null
- None of the three conditional return paths match → the grid re-renders briefly
- Then the catch sets `errorMessage`, but `selectedKey` is cleared by its own `finally`

The component may flash between states, and if the mutation error is unhandled by React Query internally, it could cause an unhandled rejection.

### Problem 3: OutfitDetail "not found" looks blank
If navigation somehow succeeds with a stale/invalid ID, OutfitDetail renders "Outfit not found" with `text-lg font-medium` on `bg-background` — which in light mode appears as a near-invisible cream page with small text. User perceives this as "blank white page."

## Fix Plan

### 1. Fix double-serialization in `edgeFunctionClient.ts`
Pass the body as a plain object and let Supabase client handle serialization. Remove the manual `JSON.stringify` and the custom Content-Type header (Supabase sets it automatically for objects).

### 2. Add debug logging in `useOutfitGenerator.ts`
Add `console.log` at key points:
- Before/after edge function call (log `data` and `error`)
- After outfit insert
- Before returning the result
This will capture what's happening on the next failure.

### 3. Harden StylePicker error flow
- Wrap the entire `handlePick` body in more robust error handling
- Don't clear `selectedKey` in `finally` if there was an error — let the error state render with the selected key for context
- Add console.log to trace the generation result before navigation

### 4. Add visible error state to OutfitDetail
Currently, the `!outfit` state is very subtle. Add a more visible "not found" page with an icon and clear call-to-action.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/edgeFunctionClient.ts` | Remove `JSON.stringify(body)` — pass object directly; remove custom Content-Type header |
| `src/hooks/useOutfitGenerator.ts` | Add console.log at key tracing points |
| `src/pages/StylePicker.tsx` | Fix error handling race condition; add logging |
| `src/pages/OutfitDetail.tsx` | Make "not found" state more visible |

