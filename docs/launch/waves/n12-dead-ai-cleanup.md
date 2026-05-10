# N12 — Dead AI cleanup + missing wires

| Field | Value |
|---|---|
| Goal | Remove edge functions that no caller in mobile or web invokes; wire the two functions that should be wired (prefetch_suggestions, generate_garment_images). |
| Status | TODO |
| Branch | `mobile-n12-dead-ai-cleanup` |
| PR count | 1 |
| Depends on | N11 |
| Complexity | M |

## Background

The 2026-05-10 audit found 4 unused / empty function directories and 2 orphan functions with code but no caller. `style_twin` is officially CUT per `docs/launch/overview.md` scope decisions. `process_garment_image` was deprecated by web in P15 (`src/lib/garmentIntelligence.ts:335` comment). Both `seed_wardrobe/` and `smart_shopping_list/` directories are empty placeholders. `prefetch_suggestions` IS called by web (`src/hooks/useAddGarment.ts:494` on the user's 5th garment) but never from mobile. `generate_garment_images` produces AI photos for text-only garment entries — useful but unwired.

## Files touched

### Deleted
- `supabase/functions/style_twin/` — entire directory. Style Twin is in launch CUT list.
- `supabase/functions/process_garment_image/` — empty directory.
- `supabase/functions/seed_wardrobe/` — empty directory.
- `supabase/functions/smart_shopping_list/` — empty directory.
- `supabase/functions/_shared/scale-guard.ts` — remove `style_twin` row from `RATE_LIMIT_TIERS` (referenced in `supabase/functions/CLAUDE.md` rate limit table).

### Modified — wire prefetch_suggestions
- `mobile/src/hooks/useAddGarment.ts` — after a successful save, if user's `garmentCount` becomes 5, fire-and-forget `callEdgeFunction('prefetch_suggestions', { user_id, trigger: 'first_5_garments' })`. Mirror web's behavior at `src/hooks/useAddGarment.ts:493-497`. Use `.catch(() => {})` — intentional silent failure (warm-up cache, non-critical).

### New — wire generate_garment_images
- `mobile/src/hooks/useGenerateGarmentImage.ts` — single-garment mutation hook: `callEdgeFunction('generate_garment_images', { garment_ids: [garmentId] })`. Standard mutation skeleton (`useAddGarment.ts` shape), `captureMutationError('useGenerateGarmentImage')` on `onError`. Invalidates `['garments']` and `['garment', id]` on success.
- `mobile/src/screens/GarmentDetailScreen.tsx` — when a garment has no `image_path` AND no `render_status` set (i.e., user added it manually without a photo), surface a "Generate image" `Button` near the existing condition / studio actions row. Uses the new hook. Disabled while pending; shows skeleton on the garment card via existing `useSignedUrl` flow once `image_path` is set.

### Modified — overview pointer
- `docs/launch/overview.md` — flip CURRENT WAVE pointer past N11 and N12; mark them DONE in wave index.

## Acceptance gates

- TypeScript: 0 errors
- Lint: 0 warnings under `"src/**/*.{ts,tsx}"` glob
- expo-doctor: passes
- Bundle export: succeeds
- `npx supabase functions list --linked` no longer includes the four removed functions (verify no remote-only orphan after merge)
- Manual: add a garment without a photo in the simulator; confirm "Generate image" shows; tap; image appears within ~10s
- Manual: clear wardrobe, add 5 garments; confirm `prefetch_suggestions` request fires (network log) but does not block UI
- Code-reviewer: approved (P0/P1 free)
- Codex review loop: ≥1 positive signal

## Deploy

After merge:
- Edge function removal: this is a remote-only delete. From main, run `npx supabase functions delete style_twin --project-ref khvkwojtlkcvxjxztduj`, repeat for `process_garment_image`, `seed_wardrobe`, `smart_shopping_list`. Confirm absence with `npx supabase functions list --linked`.
- No migrations.
- Edge function deploy: `generate_garment_images` was patched (Codex P1 round 3) to thread `userId` + the service client into `callBursAI` so the N2 monthly cost ceiling and `ai_token_usage` ledger run. Deploy with `npx supabase functions deploy generate_garment_images --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt` after merge.

## PR template

Title: `chore(backend+mobile): N12 — dead AI cleanup + prefetch/image-gen wires`

## Risk notes

- Deleting `style_twin` is consistent with `docs/launch/overview.md` "Cut from launch — Style Twin" entry. If anyone references it in the wave files, those reads are stale.
- `generate_garment_images` is rate-limited at 20/hr / 3/min and gated by subscription. The button must respect those errors — the hook surfaces 429 / 402 via `EdgeFunctionRateLimitError` / paywall sentinel which the existing `usePaywallContext` already handles.
