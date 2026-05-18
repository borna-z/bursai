# SSE keepalive audit — 2026-05-18

Verifies that every Edge Function that actually streams to the client has a
keepalive heartbeat, so intermediate proxies (Supabase Edge Runtime, Cloudflare,
mobile carriers) don't tear down idle connections during long-running AI calls.

## Streaming functions with keepalive

- `supabase/functions/mood_outfit/index.ts` — 2 s interval via `setInterval`
  emitting `: keepalive\n\n` SSE comment (lines 419–423). Required because
  `generateMoodOutfitPayload` runs an async AI call between SSE open and the
  single `sendData(payload)`, so the stream has a long quiet window mid-flight.

- `supabase/functions/shopping_chat/index.ts` — delegates to `streamBursAI`
  (`_shared/burs-ai.ts:1181`), which emits a 15 s keepalive heartbeat as part of
  the shared helper. Confirmed at `shopping_chat/index.ts:171` calling
  `streamBursAI(...)`.

## Non-streaming (no keepalive needed)

- `supabase/functions/style_chat/index.ts` — returns SSE on the wire
  (`Content-Type: text/event-stream`, line 496), BUT all chunks are enqueued
  synchronously inside `ReadableStream.start(controller)` (lines 476–490)
  immediately followed by `controller.close()`. The full response body is
  produced before the stream is constructed (`callBursAI` resolves first, then
  the envelope is built, then `createSseTextResponse` is called). There is no
  async gap during which a proxy could time the connection out, so no keepalive
  is required.

- `supabase/functions/travel_capsule/index.ts` — plain JSON response
  (`return new Response(JSON.stringify({...}), ...)` at line 775). Not
  streaming.

- `supabase/functions/wardrobe_gap_analysis/index.ts` — plain JSON response
  (`Content-Type: application/json` at line 530). Not streaming.

## Verdict

All confirmed-streaming endpoints with an async gap between stream open and
stream close have keepalive coverage. `style_chat` is technically SSE but
synchronous-enqueue + immediate-close, so it cannot hang. No pre-launch action
needed.
