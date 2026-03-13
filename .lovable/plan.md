

# Fix Plan: Score Improvement (74 → ~82+)

Three targeted changes to address the audit findings.

## 1. Remove `@react-three/*` packages from `package.json`

The imports were already removed from source code but the packages remain as dead dependencies, inflating `node_modules` and bundle analysis.

**`package.json`**: Remove these two lines:
- `"@react-three/drei": "^9.122.0"`
- `"@react-three/fiber": "^8.18.0"`

## 2. Fix CI pipeline to use Bun instead of npm

The project uses `bun.lockb` but CI runs `npm ci`, which will fail or produce inconsistent installs.

**`.github/workflows/ci.yml`**: 
- Replace `actions/setup-node@v4` with `oven-sh/setup-bun@v2`
- Change `npm ci` → `bun install`
- Change `npm run lint` → `bun run lint`
- Change `npx tsc --noEmit` → `bun run tsc --noEmit`
- Change `npm test` → `bun run test`
- Change `npm run build` → `bun run build`

## 3. Delete 6 bloat pages and their routes

These pages are premature features with no real user flow yet. Removing them cuts ~15% of page code. They can be re-added when ready.

**Pages to delete:**
- `src/pages/InspirationFeed.tsx`
- `src/pages/StyleChallenges.tsx`
- `src/pages/VisualSearch.tsx`
- `src/pages/SmartShopping.tsx`
- `src/pages/WardrobeAging.tsx`
- `src/pages/StyleTwin.tsx`

**Routes to remove from `AnimatedRoutes.tsx`:** Lines 145-151 (6 routes + their lazy imports on lines 48-54).

**Update Discover components** that link to these pages:
- `src/components/discover/DiscoverStyleTools.tsx` — remove entries pointing to deleted routes
- `src/components/discover/DiscoverSecondaryRow.tsx` — remove entries pointing to deleted routes
- `src/components/discover/DiscoverHero.tsx` — remove `/challenges` navigation
- `src/components/discover/DiscoverChallenges.tsx` — remove `/challenges` navigation

## Note on Lovable Gateway

The audit mentions "Lovable gateway migration" but the codebase already uses `https://ai.gateway.lovable.dev/v1/chat/completions` as the primary endpoint with Google AI Studio as a resilience fallback. This is already correctly implemented — no change needed.

