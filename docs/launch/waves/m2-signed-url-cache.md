# M2 — Signed-URL cache

| Field | Value |
|---|---|
| Goal | Replace `useSignedUrl` with a TTL-aware in-memory cache so list scrolling and re-renders don't burn signed-URL requests. |
| Status | DONE (PR #729) |
| Branch | `mobile-m2-signed-url-cache` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | S |

## Background

Wardrobe and outfit list screens render dozens of signed-URL fetches per scroll. Web has `useSignedUrlCache` — keyed by `bucket:path`, 50-minute TTL (signed URLs are 60 min), reuses in-flight Promises so the same path doesn't fetch twice. Mobile's current `useSignedUrl` issues a fresh request per call.

## Files touched

### New / Modified
- `mobile/src/hooks/useSignedUrl.ts` — rewrite as `useSignedUrlCache(bucket, path, ttlMs?)`. Module-level `Map<string, { url; expiresAt; inflight? }>`. Reuse in-flight Promise; return cached URL when not yet expired.
- `mobile/src/hooks/__tests__/useSignedUrlCache.test.ts` — minimal vitest cases (skip if no jest infra yet; track in findings-log.md).

### Modified call sites
- `mobile/src/components/GarmentCard.tsx`
- `mobile/src/components/OutfitCard.tsx`
- `mobile/src/components/PhotoTile.tsx`
- Any screen that resolved signed URLs directly via the old hook.

## Pattern reference

Web lifts cleanly. Mobile-specific:
- `AbortController` works in RN — wire it through.
- Don't depend on `globalThis` patterns from web; use a module-scope `Map`.
- Cache survives navigation; cleared only on `signOut` (subscribe in `AuthContext`).

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: scroll the wardrobe list 5 screens, confirm signed-URL fetch count is bounded (use Sentry breadcrumbs / network inspector if available)
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M2 — signed-URL TTL cache`
