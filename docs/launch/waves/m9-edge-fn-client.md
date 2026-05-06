# M9 — Edge function client wrapper

| Field | Value |
|---|---|
| Goal | Replace raw `fetch` calls to `/functions/v1/...` with a single client wrapper that handles auth, retry, circuit breaking, and 4xx classification consistently. |
| Status | DONE (PR #733) |
| Branch | `mobile-m9-edge-fn-client` |
| PR count | 1 |
| Depends on | V0 |
| Complexity | M |

## Background

Web `src/lib/edgeFunctionClient.ts` does: auth header injection, exponential backoff with jitter, non-retryable status classification (400/401/402/403/404 don't retry), circuit breaker per-function, AbortSignal threading. Mobile currently `fetch`es directly and either retries naively or not at all. Every mobile wave that calls an edge function (M11–M24, M28–M32) benefits from this wrapper.

## Files touched

### New
- `mobile/src/lib/edgeFunctionClient.ts` — `callEdgeFunction(name, body, opts)` returning a typed response. Internals: per-function backoff state, retry classifier matching web's, default 90s timeout, AbortSignal honored.

### Modified
- `mobile/src/hooks/useAddGarment.ts` — replace direct `fetch` with `callEdgeFunction`
- `mobile/src/hooks/useAnalyzeGarment.ts` — same
- `mobile/src/hooks/useGenerateOutfit.ts` — same
- `mobile/src/hooks/useStyleChat.ts` — SSE streams stay raw (`callEdgeFunction` returns the underlying Response when `stream: true`)
- `mobile/src/hooks/useMoodOutfit.ts` — same
- All future mutation hooks adopt the wrapper directly.

## Pattern reference

Lift `src/lib/edgeFunctionClient.ts` body. Strip the React-specific tracing hooks if any; mobile's Sentry breadcrumb shape differs from web.

```ts
type CallOpts = {
  signal?: AbortSignal;
  retries?: number;          // default 2
  timeoutMs?: number;         // default 90_000
  stream?: boolean;           // default false; if true returns raw Response
  headers?: Record<string, string>;
};
```

Subscription-required (HTTP 402) bubbles up as a typed error so paywall surfaces can intercept.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Grep: `fetch(\`${supabaseUrl}/functions/v1/` should appear only inside `edgeFunctionClient.ts`
- Manual: kill the network mid-analyze, confirm retry; trigger a 402, confirm paywall appears (don't retry)
- Code-reviewer: approved

## Deploy

None.

## PR template

Title: `feat(mobile): M9 — edge function client wrapper`
