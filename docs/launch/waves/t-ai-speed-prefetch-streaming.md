# T — AI speed: prefetch on open, garment cache passthrough, streaming outfit, model-routing fixes

> Queued after Wave S. Source: user-supplied implementation prompt 2026-05-15 with code-side verification against `main`. Four targeted AI-performance changes bundled as a single atomic PR (per user direction — "one commit at the end covering all four changes"). Where the source prompt's described API shape diverged from what's in `main`, this wave file uses the actual code shape (noted inline below).

| Field | Value |
|---|---|
| Goal | Four AI-speed wins: (T-A) prefetch outfit suggestions on app open so Gemini result is warm-cached before the user navigates; (T-B) pass client-side garment ID list into `style_chat` so the server skips its per-turn user-scan; (T-C) convert `generate_outfit` to SSE so the screen renders progressively; (T-D) correct two `callBursAI` complexity tiers that overspend on simple classification. |
| Status | TODO |
| Branch base | `main` |
| Branch name | `prompt-ai-speed-four-improvements` (per user) |
| PR count | 1 (atomic) |
| Migrations | None |
| Edge function changes | `prefetch_suggestions` (none — already exists), `style_chat/wardrobe-context.ts`, `style_chat/index.ts`, `generate_outfit/index.ts`, `detect_duplicate_garment/index.ts`, `assess_garment_condition/index.ts` |
| Native modules | None |
| Bundle impact | None |
| Complexity | M (single PR, four small tasks, no migrations, no native work) |
| Authority | Standing CEO post-launch theme-PR authority |

## Relationship to Waves R and S

- **Wave R (R-A deferred, R-B/C/D merged):** closed the platform-parity + on-device-BG-removal + add-flow polish gap. None of T's tasks overlap.
- **Wave S (queued):** edge-function-only security hardening (S-A) + structured output + context caching (S-B) + perceived-speed wins (S-C). S-C.1 (analyze prefetch in Step 1) and T-A (suggestion prefetch on app open) are *different* prefetches — S-C is AddPiece-scoped; T-A is HomeScreen-scoped. No conflict. **T runs after S.**

---

## T-A · Wire `prefetch_suggestions` on app open

### Scope
When the app launches (or returns from background), silently call the existing `prefetch_suggestions` edge function so Gemini's daily-outfit result is cached server-side by the time the user opens outfit generation. Best-effort, fire-and-forget.

### Code-side verification (against `main`)
- `supabase/functions/prefetch_suggestions/index.ts` exists; POST handler at line 111; bearer-auth (line 124+); reads garments (`.from("garments").select(...).eq("user_id", userId)` at line 40+); writes `ai_response_cache` via `callBursAI`'s caching args.
- `mobile/src/lib/edgeFunctionClient.ts` exports `callEdgeFunction` with `CallOpts { retries?, timeoutMs?, body? }` (lines 41–58).
- `mobile/src/screens/HomeScreen.tsx` imports + mounts `SmartDayBanner` (line 21 + JSX line 312–317). It does NOT directly call `useSmartDayRecommendation` (the source prompt's framing was slightly off — irrelevant to this task).

### Implementation

**1. New hook** `mobile/src/hooks/usePrefetchSuggestions.ts`:
- No arguments.
- Uses `useAuth` for the current session.
- Exposes `prefetch(): Promise<void>`.
- Body: `callEdgeFunction('prefetch_suggestions', { body: {}, retries: 0, timeoutMs: 15_000 })`.
- Errors swallowed silently; report via `Sentry.captureException` at level `'info'` (use `Sentry.withScope` to set the level, since the React Native Sentry SDK's `captureException` doesn't take a level option directly — implementer to confirm at impl time and adapt).
- Never throws; never updates any UI state.

**2. Mount in HomeScreen** (`mobile/src/screens/HomeScreen.tsx`):
- Import `usePrefetchSuggestions`.
- `const { prefetch } = usePrefetchSuggestions()` at the top of the component.
- `useEffect(() => { prefetch(); }, [])` — fire once on mount, no cleanup, no render-blocking.

**Stretch (defer if it inflates the PR):** also fire `prefetch()` on `AppState` change from `background` to `active`. The base wave is mount-only; AppState wiring can be a follow-up.

### Acceptance
- Cold-start Home → `prefetch_suggestions` request visible in Supabase logs within ~1s.
- Hook never throws into the React tree (no red screen / no boundary catches).
- HomeScreen render time unchanged (fire-and-forget, no blocking).

---

## T-B · Pass garment ID list from RQ cache into `style_chat`

### Scope
Skip the per-turn wardrobe-table scan that `style_chat` does today. Mobile already has the garment list in React Query cache; send the IDs in the request body so the server does an indexed `IN`-scoped re-fetch (still needed for the row contents we don't ship) instead of a user-wide scan.

### Code-side verification (against `main`)
- `useStyleChat.stream.ts`: `StyleChatRequestBody` is a union; the non-shopping branch already includes `selected_garment_ids?: string[]` (line 26). `buildRequestBody` is exported (line 46–69).
- `useStyleChat.ts:649–655` calls `buildRequestBody({ mode, messagesPayload, anchoredGarmentId: anchorRef.current, activeLookPayload: finalActiveLookPayload, lockedSlots: lockedSlotsForRequest })` — exactly the shape the source prompt described.
- `useGarments.ts:190–197` exports `useFlatGarments()` returning a spread query plus a flattened `data: Garment[]`.
- `style_chat/wardrobe-context.ts:53` — `getWardrobeContext(supabase, userId, messages, selectedGarmentIds: string[] = [])`. DB select on line 54–56 selects rich columns scoped by `.eq("user_id", userId)`.
- `style_chat/index.ts:37` imports `getWardrobeContext`. The actual call site needs to be located by the implementer (file is ~2300 LOC).

### Implementation

**1. Client (`useStyleChat.stream.ts`):**
- Add `wardrobe_garment_ids?: string[]` to the non-shopping branch of the `StyleChatRequestBody` union.
- Extend `buildRequestBody`'s `args` object with optional `wardrobeGarmentIds?: string[]`.
- Spread `...(wardrobeGarmentIds && wardrobeGarmentIds.length > 0 ? { wardrobe_garment_ids: wardrobeGarmentIds } : {})` into the non-shopping branch's return body. The `shopping` branch MUST NOT include the field.

**2. Client (`useStyleChat.ts`):**
- Import `useFlatGarments` from `'./useGarments'`.
- `const garmentsQuery = useFlatGarments()` at the top of the hook.
- ```ts
  const wardrobeIds = useMemo(
    () => (garmentsQuery.data ?? []).map((g) => g.id),
    [garmentsQuery.data],
  );
  ```
- In the `buildRequestBody(...)` call at line 649–655, add `wardrobeGarmentIds: wardrobeIds` to the args object. Nothing else changes in `sendMessage`.

**3. Server (`style_chat/wardrobe-context.ts`):**
- Add optional fourth-named arg (or fifth positional — implementer picks): `wardrobeGarmentIds?: string[]`. Updated signature: `getWardrobeContext(supabase, userId, messages, selectedGarmentIds, wardrobeGarmentIds?)`.
- Threshold: when `wardrobeGarmentIds.length >= 5`, switch the garment SELECT from `.eq("user_id", userId).order(...).limit(120)` to `.in("id", wardrobeGarmentIds).eq("user_id", userId).limit(120)`. Keep the `.eq("user_id", userId)` belt-and-braces — RLS handles it anyway, but explicit is good.
- Below 5, fall back to the existing user-wide path. This keeps the optimization off for empty / near-empty wardrobes.

**4. Server (`style_chat/index.ts`):**
- Find the `getWardrobeContext(supabase, userId, messages, selected_garment_ids)` call and pass `body.wardrobe_garment_ids ?? undefined` as the next arg.

### Important constraints (from the source prompt — preserved verbatim)
- The server's `getWardrobeContext` still owns all ranking and context-building. Mobile only supplies IDs so the server can scope its fetch.
- Do NOT attempt to pass full garment objects — only IDs.

### Acceptance
- Style chat turn with a populated wardrobe: server logs show the scoped `IN` SELECT, not the user-wide ORDER BY scan.
- Cold wardrobe (< 5 garments): behavior unchanged (falls back to user scan).
- `shopping` mode requests do not include `wardrobe_garment_ids`.

---

## T-C · Stream `generate_outfit` via SSE

### Scope
Convert `generate_outfit` from blocking JSON to SSE so the screen shows progress immediately. Single-chunk SSE — same pattern as `useMoodOutfit`.

### Code-side verification (against `main`)
- `supabase/functions/generate_outfit/index.ts:93–107` returns `new Response(JSON.stringify({...}), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })`. Confirmed blocking JSON.
- `mobile/src/hooks/useGenerateOutfit.ts` calls `burs_style_engine` (per the source prompt — not visible in the first 100 lines but the file comment on line 2 confirms). **The source prompt's stated change is to add an SSE consumer pointed at `generate_outfit` while leaving the existing `burs_style_engine` consumer untouched in spirit** — but step 2 in the prompt then says "Replace the existing `callEdgeFunction('burs_style_engine', ...)` call inside the `generate` callback with `generateViaSSE(...)`." Implementer: resolve this by **adding the SSE path AND switching the call to `generate_outfit`**. That is the user's intent: SSE-ify the outfit generation hook, even though the current endpoint is `burs_style_engine`. If `burs_style_engine` and `generate_outfit` differ in response shape, the hook needs to handle whichever endpoint it now points at — confirm the response shape against `EngineResponse` before wiring.
- `mobile/src/lib/sse.ts` actual export signature is **`fetchSSE(fnName, body, callbacks, signal?)`** with `callbacks: { onData, onDone, onError }` — NOT the `(url, options, onChunk, onDone, onError)` form in the source prompt. Use the actual signature.
- `mobile/src/lib/supabase.ts:23` exports `supabaseUrl`.
- `mobile/src/hooks/useMoodOutfit.ts` is the canonical single-chunk SSE pattern — mirror it.

### Implementation

**1. Server (`supabase/functions/generate_outfit/index.ts`):**

After building the success `result` object (the thing currently passed to `JSON.stringify`), replace the success-path response with:

```ts
const encoder = new TextEncoder();
const body = new ReadableStream({
  start(controller) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  },
});
return new Response(body, {
  headers: {
    ...CORS_HEADERS,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  },
});
```

Where `result` is the **exact same JSON object** currently passed to `JSON.stringify(...)`. Do not change the result shape.

Error responses (400/401/402/429/500) stay as plain JSON. Only the success path becomes SSE.

**2. Client (`mobile/src/hooks/useGenerateOutfit.ts`):**

Use the real `fetchSSE` signature. Mirror `useMoodOutfit.ts:108–170`:

```ts
import { fetchSSE } from '../lib/sse';

async function generateViaSSE(requestBody: GenerateRequestBody, signal: AbortSignal): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let parsed: EngineResponse | null = null;
    fetchSSE(
      'generate_outfit',
      requestBody,
      {
        onData: (raw) => {
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === 'object' && 'items' in obj) {
              parsed = obj as EngineResponse;
            }
          } catch (err) {
            // partial JSON or non-JSON keepalive — ignore until [DONE]
          }
        },
        onDone: () => {
          if (resolved) return;
          if (!parsed) { reject(new Error('generate_outfit: stream closed with no payload')); resolved = true; return; }
          resolve(parsed);
          resolved = true;
        },
        onError: (err) => {
          if (resolved) return;
          reject(err);
          resolved = true;
        },
      },
      signal,
    ).catch(reject);
  });
}
```

Then inside the `generate` callback, replace the `callEdgeFunction('burs_style_engine', ...)` (or whichever current endpoint it points at) with `generateViaSSE(requestBody, abortController.signal)`. Downstream logic (anchor check, slot validation, `setOutfit`, Sentry capture) stays identical — only the fetch mechanism changes. Set `isGenerating` / `setIsLoading` true before the SSE call; false in both resolve and reject paths.

**Caveat for implementer:** if the hook today calls `burs_style_engine` but T-C now points it at `generate_outfit`, double-check the response shape. If they differ, this is a larger change than the source prompt implies — flag and pause.

### Acceptance
- `curl` POST to `generate_outfit` returns `Content-Type: text/event-stream` and a `data: {...}\n\ndata: [DONE]\n\n` payload.
- Mobile generate-outfit screen renders the result via SSE; no blocking 3–5s blank wait.
- Existing JSON consumers (cron / cross-function callers, if any) continue to work — check edge-fn imports of `generate_outfit` before merge.

---

## T-D · Model-routing fixes: `detect_duplicate_garment` + `assess_garment_condition`

### Scope
Two functions currently waste model budget on simple classification:

- **`detect_duplicate_garment`** omits `complexity` → falls through to `standard` (still flash-lite primary but 600 tokens vs. trivial's 300). It's a 0.0–1.0 binary similarity score; trivial fits.
- **`assess_garment_condition`** uses `complexity: 'complex'` → routes to `gemini-2.5-flash` (the expensive primary). It returns a tiny condition classification (new / good / fair / worn). Should be trivial.

### Code-side verification (against `main`)
- `assess_garment_condition/index.ts:75–87` confirmed: `callBursAI({ complexity: "complex", max_tokens: 200, messages: [...], ... })`.
- `detect_duplicate_garment/index.ts` call site not visible in the first 100 lines of the file — implementer locates the `callBursAI` call and confirms no `complexity` field is set.
- `_shared/burs-ai.ts:34–47` — COMPLEXITY_CHAINS confirmed: trivial/standard both → flash-lite primary; complex → flash primary. The source prompt's framing is exact.

### Implementation

**1. `supabase/functions/detect_duplicate_garment/index.ts`:** add to the existing `callBursAI({...})` options object:
```ts
complexity: 'trivial',
max_tokens: 200,
temperature: 0,
```

**2. `supabase/functions/assess_garment_condition/index.ts:75–87`:** change `complexity: "complex"` → `complexity: "trivial"`. Keep `max_tokens: 200`. Add `temperature: 0`.

### Acceptance
- Both functions' next 100 invocations log `model_used` as `gemini-2.5-flash-lite` (currently `detect_duplicate_garment` is correct already; `assess_garment_condition` should flip from `flash` to `flash-lite`).
- Output shape unchanged in both functions.
- No JSON parse failures introduced (temp=0 is fine for classification).

---

## Single-commit / single-PR sequencing

Per user direction: all four tasks ship in one atomic commit. Validation gate is run **after every task** (`npx tsc --noEmit --skipLibCheck` from `mobile/` for TS-touching tasks; `deno check` on edge function files for server tasks) — but only the final state is committed.

```
[T-A] usePrefetchSuggestions + HomeScreen mount
  → tsc --noEmit --skipLibCheck (mobile/)
[T-B] style_chat passthrough (client + server)
  → tsc --noEmit --skipLibCheck (mobile/)
  → deno check supabase/functions/style_chat/wardrobe-context.ts
  → deno check supabase/functions/style_chat/index.ts
[T-C] generate_outfit SSE (server + client hook)
  → tsc --noEmit --skipLibCheck (mobile/)
  → deno check supabase/functions/generate_outfit/index.ts
[T-D] complexity tier fixes
  → deno check on both files
[ALL] V0 mobile CI gates (lint + typecheck + test + expo-doctor) per reference-mobile-ci-gates
[COMMIT] "perf: prefetch on open, garment cache passthrough, streaming outfit, model routing fixes"
```

Branch: `prompt-ai-speed-four-improvements` (user-specified).

User direction: **push the branch — do not open a PR**.

### Edge-function deploys (post-merge, from `main`)
Only the modified functions, one at a time (per `CLAUDE.md`):
```
npx supabase functions deploy style_chat --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy generate_outfit --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy detect_duplicate_garment --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy assess_garment_condition --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

`prefetch_suggestions` itself is unchanged — no redeploy needed.

---

## CI / testing

Per `reference-mobile-ci-gates`:
```bash
cd mobile
npm run lint -- "src/**/*.{ts,tsx}" --max-warnings 0
npm run typecheck
npm run test
```

Edge functions:
```bash
deno check supabase/functions/style_chat/wardrobe-context.ts
deno check supabase/functions/style_chat/index.ts
deno check supabase/functions/generate_outfit/index.ts
deno check supabase/functions/detect_duplicate_garment/index.ts
deno check supabase/functions/assess_garment_condition/index.ts
```

Codex review loop per `feedback-codex-review-loop`. Self-review loop after Codex per `feedback-self-review-after-codex`. Three-thumbs merge gate per `feedback-three-thumbs-merge-gate`.

**Manual smoke matrix:**
| Surface | Smoke |
|---|---|
| App cold start | Open app → check Supabase logs for `prefetch_suggestions` hit within ~1s |
| Style chat | Send a turn with a populated wardrobe → server logs show `.in("id", [...])` SELECT, not user-wide scan |
| Generate outfit | Open outfit-generation screen → response renders via SSE within network time; no blocking spinner |
| Duplicate detection | Add a near-dupe garment → model_used logs `gemini-2.5-flash-lite` |
| Assess condition | Tap Check Condition on a garment → model_used logs `gemini-2.5-flash-lite` (was `gemini-2.5-flash`) |

---

## Risk register

| Risk | Mitigation |
|---|---|
| `useGenerateOutfit` currently calls `burs_style_engine` and T-C points it at `generate_outfit`; response shapes may differ | Implementer compares `EngineResponse` to the shape `generate_outfit` actually returns BEFORE wiring. If mismatch, flag and either (a) keep `burs_style_engine` as the SSE target by SSE-ifying that function instead, or (b) split T-C into two commits. |
| Source prompt's `fetchSSE(url, options, onChunk, onDone, onError)` signature does not match the real `(fnName, body, callbacks, signal)` shape | This wave file uses the real signature; mirror `useMoodOutfit.ts:108–170` |
| `Sentry.captureException` in React Native SDK doesn't accept a `level` arg directly | Use `Sentry.withScope((scope) => { scope.setLevel('info'); Sentry.captureException(err); })` — implementer to confirm against installed SDK version |
| Garment ID list for `wardrobe_garment_ids` could exceed Supabase row-IN-list limits on power users (1000+ garments) | Threshold at 120 IDs client-side before sending; server has `.limit(120)` anyway — clip the array in `useStyleChat.ts` if length exceeds 200 |
| `style_chat/wardrobe-context.ts` ranking logic may depend on the existing `.order(...)` clause (e.g., last-worn-first) | When falling back to the IN-scoped path, preserve the same `.order("last_worn_at", { ascending: false, nullsLast: true })` or whichever ordering exists today |
| SSE conversion breaks any non-mobile consumer of `generate_outfit` (cron / cross-fn) | grep edge-functions and `src/` for `generate_outfit` callers before merge; if any expect JSON, leave a `?stream=false` query-param fallback that returns JSON |
| Temperature=0 on `detect_duplicate_garment` similarity scoring eliminates noise but could over-anchor near 0.5 borderline cases | Acceptance: spot-check 20 known-pair / known-non-pair garments; if borderline cases get worse, raise temp to 0.1 (still well under standard) |
| Atomic single PR raises blast radius if Codex blocks | If any one task fails Codex review, split into per-task commits on the same branch — Codex re-runs per push |

---

## Out of Wave T scope (deferred)

- AppState foreground-resume prefetch (mount-only ships in T-A; resume hook is a one-line follow-up).
- Streaming `burs_style_engine` (T-C only converts `generate_outfit`).
- Per-mode `temperature` tuning across the rest of the AI fleet (only the two trivial-classification fixes ship here).
- Anything from Wave S (S-A/S-B/S-C) — T runs AFTER S.

---

## Open questions for user before T merges

- Confirm the `useGenerateOutfit` SSE target: the source prompt says the hook currently calls `burs_style_engine` but T-C is titled "generate_outfit SSE." Which function should end up streaming — `generate_outfit`, `burs_style_engine`, or both? Default: SSE-ify `generate_outfit` server-side AND switch the hook to call it, per the source prompt's step 2.
- Push-only directive: user said "do not open a PR — just push the branch." Confirm this is intentional (overrides the standing `feedback-pr-gate-workflow` rule that requires a PR + Codex loop + tracker update). If yes, the merge gate is also bypassed; if no, this becomes a normal PR-tracked wave.
