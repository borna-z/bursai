# Phase 2 — Stylist hooks

**Roadmap:** [Modularization roadmap](./2026-05-16-burs-modularization-roadmap.md)
**Previous phase:** [Phase 1 — State foundations](./2026-05-16-burs-modularization-phase-1-state-foundations-design.md)
**Next phase:** [Phase 3 — Screen splits](./2026-05-16-burs-modularization-phase-3-screen-splits-design.md)
**Suggested branch:** `refactor/stylist-hooks`

## Problem

Three hooks drive the heaviest user-facing flows and have absorbed unrelated concerns over time:

- `hooks/useStyleChat.ts` (997 lines) — SSE plumbing + history hydration + persisted-message parsing + suggestion-chip routing + active-look badge state + subscription gating.
- `hooks/useWeekGenerator.ts` (544 lines) — 7-day generation loop + weather fetch + recently-worn query + per-day error capture + subscription gating + UI state.
- `hooks/usePhotoFeedback.ts` (512 lines) — outfit feedback fetch + per-photo summary derivation + storage cleanup heuristics + subscription gating.

Each has 10+ `useEffect/useState/useCallback` invocations and is impossible to unit-test in isolation.

## Goal

Decompose each into focused hooks plus pure helpers. Orchestrator hooks remain as the public API consumers import, but they are thin (< 300 lines) and delegate to sub-hooks.

## Approach

For each hook, identify the underlying concerns and split into:

1. A **mechanics** sub-hook (network I/O, streaming, retries) — pure async work.
2. A **state** sub-hook (UI state shape, derived values) — pure state machine.
3. A **lifecycle / orchestration** layer in the public hook that wires (1) and (2).

Pull pure derivation logic into `lib/` modules so it is tested without React.

## Scope

### `useStyleChat`

- `hooks/useStyleChatStreaming.ts` *(new)* — SSE mechanics only. Inputs: request body, AbortController. Outputs: stream of partial messages + final message. No UI state.
- `hooks/useStyleChatHistory.ts` *(new)* — fetch + parse persisted chat history from Supabase. Returns `{ messages, isLoading, error }`.
- `hooks/useStyleChatUI.ts` *(new)* — owns mode pills, suggestion chips, active-look badge state. Pure state machine over user actions.
- `hooks/useStyleChat.ts` (rewritten) — orchestrator. Composes the three sub-hooks. < 250 lines.
- `lib/styleChatNormalizer.ts` — already exists per audit; ensure single source of truth for message shape and that history hydration calls into it (no duplicated parsing).

### `useWeekGenerator`

- `hooks/useWeekGenerationLoop.ts` *(new)* — FIFO day dispatch + per-day error capture + abort handling. Stateless: returns generated entries via callbacks/Promise.
- `hooks/useWeatherAndContext.ts` *(new)* — weather fetch + recently-worn query + day-context builder. Reusable across other day-aware features.
- `hooks/useWeekGenerator.ts` (rewritten) — orchestrator: weather/context first, then loop dispatch, then UI state (`entries`, `regeneratingDates`, `completed`). < 280 lines.

### `usePhotoFeedback`

- `hooks/useFeedbackFetch.ts` *(new)* — edge function call + error classification. No storage cleanup.
- `hooks/useFeedbackCleanup.ts` *(new)* — encapsulates `bestEffortRemoveSelfie`, `deleteTemp` style-storage operations. Idempotent; safe to no-op.
- `lib/feedbackNormalizer.ts` *(new)* — `adaptFeedback`, `deriveSummary`, `selfieDetector` heuristic. Pure; unit-testable.
- `hooks/usePhotoFeedback.ts` (rewritten) — orchestrator. < 220 lines.

### Out of scope

- Replacing SSE with a different transport.
- Restructuring the chat-message storage schema.
- Touching the underlying edge functions (`style_chat`, `mood_outfit`, etc.) — that is Phase 5.
- UI changes to `StyleChatScreen`, `PlanScreen`, `PhotoFeedbackScreen` beyond hook import path.

## Files touched

| Path | Change |
|---|---|
| `mobile/src/hooks/useStyleChat.ts` | Slim orchestrator. |
| `mobile/src/hooks/useStyleChatStreaming.ts` *(new)* | SSE mechanics. |
| `mobile/src/hooks/useStyleChatHistory.ts` *(new)* | History fetch. |
| `mobile/src/hooks/useStyleChatUI.ts` *(new)* | UI state. |
| `mobile/src/hooks/useWeekGenerator.ts` | Slim orchestrator. |
| `mobile/src/hooks/useWeekGenerationLoop.ts` *(new)* | Loop dispatch. |
| `mobile/src/hooks/useWeatherAndContext.ts` *(new)* | Weather + context. |
| `mobile/src/hooks/usePhotoFeedback.ts` | Slim orchestrator. |
| `mobile/src/hooks/useFeedbackFetch.ts` *(new)* | Fetch only. |
| `mobile/src/hooks/useFeedbackCleanup.ts` *(new)* | Storage cleanup. |
| `mobile/src/lib/feedbackNormalizer.ts` *(new)* | Pure normalization helpers. |
| `mobile/src/hooks/__tests__/*` | Update existing tests; add unit tests for each new pure helper. |

## Acceptance criteria

- Each orchestrator hook < 300 lines.
- `lib/feedbackNormalizer.ts` covered by unit tests for: standard outfit feedback, selfie detection (positive + negative), empty payload.
- `useStyleChatStreaming` covered by a test that mocks an SSE response and asserts incremental message accumulation.
- `useStyleChatScreen`, `PlanScreen`, `PhotoFeedbackScreen` consume the orchestrator hooks via existing import paths — no UX regression.
- Manual smoke: send a stylist chat message → streams; refresh chat → history hydrates; open Plan → 7 days generate; open Photo Feedback → results render.
- All existing tests pass with at most import-path updates.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Splitting `useStyleChat` introduces race conditions between streaming and history hydration | Hydration runs first on mount; streaming only starts after hydration resolves or fails. Add a deterministic test for this ordering. |
| Week generator regression — sequential vs parallel calls | Keep the existing sequential behavior. Document it in `useWeekGenerationLoop` JSDoc. Add a test that asserts calls are sequential (mock the edge function and assert call ordering). |
| Photo feedback cleanup runs at wrong time | Cleanup hook scopes lifecycle to "after success", same as today. Add a test asserting cleanup only runs after successful fetch. |

## Verification before completion

```bash
npm test --prefix mobile
npx eslint "mobile/src/**/*.{ts,tsx}" --max-warnings 0
# Manual: stylist chat round-trip, Plan generation, Photo Feedback.
```

## When picking this up cold

1. Read `mobile/src/hooks/useStyleChat.ts` end-to-end.
2. Read `mobile/src/hooks/useWeekGenerator.ts` end-to-end.
3. Read `mobile/src/hooks/usePhotoFeedback.ts` end-to-end.
4. Read `mobile/src/lib/styleChatNormalizer.ts` (already extracted; understand its boundary).
5. Grep consumers of each hook to enumerate every prop and return-value the public API must keep.
