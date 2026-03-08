

## Background Seed Wardrobe

### Problem
Currently, the seed loop runs inside the `SeedWardrobe` component. Navigating away unmounts the component and kills the process. The user must stay on that page for ~10 minutes.

### Solution
Create a global **SeedContext** that holds the seeding loop and state at the app level. The loop continues running regardless of which page the user is on. The `SeedWardrobe` page becomes a thin UI that reads from and controls this context. A small floating progress pill shows on all pages while seeding is active.

### Architecture

```text
┌─────────────────────────────┐
│  SeedContext (app-level)    │
│  - step, completed, failed  │
│  - results[], cancelRef     │
│  - run(), retryFailed()     │
│  - Runs loop in background  │
└──────────┬──────────────────┘
           │ provides state
     ┌─────┴──────┐
     │             │
  SeedWardrobe   SeedPill
  (full page)    (floating mini
   /settings/     indicator on
   seed-wardrobe) all pages)
```

### Files to Create
1. **`src/contexts/SeedContext.tsx`** — Global context + provider holding all seed state and the `run()` / `retryFailed()` / `cancel()` functions (logic moved from SeedWardrobe.tsx)

2. **`src/components/layout/SeedProgressPill.tsx`** — Small floating pill (bottom-right, above nav) showing "Seeding: 12/100" with a progress ring. Tapping it navigates to `/settings/seed-wardrobe`. Only visible when seeding is active.

### Files to Edit
3. **`src/App.tsx`** — Wrap with `<SeedProvider>`
4. **`src/pages/settings/SeedWardrobe.tsx`** — Strip all state/logic, consume `useSeed()` context instead. Keep the full UI (stats, progress bar, results log, buttons).
5. **`src/components/layout/AppLayout.tsx`** — Render `<SeedProgressPill />` so it appears on every page.

### No backend changes needed
The edge function and DB stay the same. Only the client-side orchestration moves from component state to a global context.

