import type { MockRoute } from "./mock-server";

// Gemini mock routes. P0d-ii scaffolding — the array is empty by design.
//
// P0d-iii will populate this as the 7 Gemini-dependent smoke tests land
// (enrichment, render, outfit-generate, outfit-refine, visual-search,
// shopping-chat, travel-capsule). Each test adds:
//   1. A fixture JSON under src/test/smoke/fixtures/gemini/<flow>.json
//      captured from a real Gemini call (see ADR in LAUNCH_PLAN.md for
//      the one-time $5–20 seeding-cost estimate).
//   2. A route below mapping the edge function's Gemini URL pattern to
//      that fixture.
//
// Matching strategy: edge functions call Gemini via the OpenAI-compatible
// endpoint. When P0d-iii wires the local functions runtime to point at
// this mock (via GEMINI_API_URL override), the request path will contain
// `/v1beta/chat/completions` or similar. Routes below should regex-match
// on path only; request body is available to dynamic handlers if one
// fixture-per-URL is too coarse.
//
// Example (do not ship until P0d-iii):
//   {
//     method: "POST",
//     pathPattern: /\/v1beta\/.*\/generateContent/,
//     response: {
//       type: "fixture",
//       filename: "gemini/enrichment.json",
//     },
//   },
export const geminiRoutes: MockRoute[] = [];
