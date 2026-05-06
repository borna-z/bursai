# M14 — 8-mode chat contract + AIChat depth

| Field | Value |
|---|---|
| Goal | Port the full styleChatContract so mobile chat handles all 8 modes (refinement, garment-first, outfit-generation, wardrobe-gap, purchase-prioritization, style-identity, look-explanation, planning, conversational) plus chat history persistence and inline memory edit. |
| Status | TODO |
| Branch | `mobile-m14-chat-8-mode` |
| PR count | 1 |
| Depends on | V0, M9, M10 |
| Complexity | L |

## Background

Web `style_chat` is a 2300-line edge function consumed via mode-aware contract types in `src/lib/styleChatContract.ts` + `src/lib/styleChatNormalizer.ts`. Mobile's `useStyleChat` is conversational-only — no mode detection, no active-look threading, no chat history. Worse: M10 wires `memory_ingest` so the chat context is now meaningful, but the chat itself doesn't show or edit memory.

## Files touched

### New
- `mobile/src/lib/styleChatContract.ts` — port the 8-mode union, request/response envelope types, ActiveLookInput shape
- `mobile/src/lib/styleChatNormalizer.ts` — port: round-trip messages through DB-safe form
- `mobile/src/hooks/useStyleMemoryFacts.ts` — query `user_style_summaries` + a few high-confidence preference rows; surface as "what burs remembers about you"
- `mobile/src/hooks/useRecordMemoryEvent.ts` — write a corrective memory event ("forget that I prefer X") via `memory_ingest`

### Modified
- `mobile/src/screens/StyleChatScreen.tsx` — full rewrite. Mode pill on each message. Active-look envelope on chat refinement. Chat history persisted in `chat_messages`. Inline "memory chip" rows expanding to edit / forget.
- `mobile/src/hooks/useStyleChat.ts` — emit per the contract (mode + active_look); SSE response parsed by the normalizer; persistence on each turn.

## Pattern reference

Web `AIChat.tsx` is the integration reference. SSE plumbing already exists in `mobile/src/lib/sse.ts` from W4.

## Acceptance gates

- TypeScript: 0 errors
- V0 CI gates: all green
- Manual: chat conversation → switch to refinement mode → anchor a garment → confirm chat replies with refinement contract; close + reopen chat → history restored; tap "what burs remembers" → confirm memory facts shown; tap "forget" → confirm `memory_ingest` writes the correction
- Code-reviewer: approved

## Deploy

None — `style_chat` already deployed; M23 Shopping Chat extends the same surface later.

## PR template

Title: `feat(mobile): M14 — 8-mode chat contract + AIChat depth`
