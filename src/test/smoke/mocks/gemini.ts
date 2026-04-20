import type { MockRoute } from "./mock-server";

// Gemini mock routes. Covers both transports edge functions use:
//
// 1. OpenAI-compatible chat/completions endpoint (consumed by `callBursAI` +
//    `streamBursAI` in `supabase/functions/_shared/burs-ai.ts`). The function
//    decides streaming on the per-request `stream: true` body flag — the mock
//    routes therefore inspect the request body and branch between a
//    single-shot JSON response and an SSE stream.
//
// 2. Native Gemini `generateContent` endpoints used by:
//    - `supabase/functions/_shared/gemini-image-client.ts` (image generation,
//      consumed by `render_garment_image`)
//    - `supabase/functions/_shared/render-eligibility.ts` (render gate,
//      consumed by `render_garment_image`)
//
// Each edge function gets a response shape that's just correct enough for the
// function to persist a row and return a happy-path body — we don't try to
// return contextually perfect AI output. Tests assert on DB side-effects +
// envelope shape, not on the AI content itself.
//
// The Google SDK and the BURS code don't care about URL path suffixes beyond
// the keywords in the path. Matching is case-sensitive regex against the
// incoming request URL.

// ─── Chat / completions response shapes ──────────────────────

interface OpenAIMessage {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function openAIResponse(content: unknown, model = "gemini-2.5-flash-lite"): OpenAIResponse {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 50, completion_tokens: 80, total_tokens: 130 },
  };
}

// A tool-call response — used when the edge function passes `tools: [...]` and
// expects the model to return a structured JSON blob via `tool_calls[0].function.arguments`.
function openAIToolCallResponse(args: Record<string, unknown>, toolName = "return_response", model = "gemini-2.5-flash-lite"): OpenAIResponse {
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          tool_calls: [
            {
              id: `call_${crypto.randomUUID()}`,
              type: "function",
              function: { name: toolName, arguments: JSON.stringify(args) },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 50, completion_tokens: 80, total_tokens: 130 },
  };
}

// Build a short happy-path AI output shape that satisfies every BURS consumer
// we mock here. Most functions either:
//   - accept any JSON they can parse out of `message.content`
//   - accept a plain string (shopping_chat, style_chat streaming path)
//   - expect a specific structured JSON (analyze_garment enrichment, etc.)
//
// The strategy: sniff the request body for known tool schemas / keywords and
// pick the response that matches. If nothing matches, fall through to a
// generic text response — callers that require a specific shape will fail
// their test loudly, which is the point (test catches drift in our mock too).
function buildChatCompletionResponse(reqBody: string): OpenAIResponse {
  let parsed: { messages?: unknown; tools?: unknown; stream?: boolean; model?: string } = {};
  try {
    parsed = JSON.parse(reqBody);
  } catch {
    // Fall through to generic response
  }

  const model = typeof parsed.model === "string" ? parsed.model : "gemini-2.5-flash-lite";
  const systemPrompt =
    Array.isArray(parsed.messages)
      ? (parsed.messages as Array<{ role?: string; content?: unknown }>)
          .filter((m) => m?.role === "system")
          .map((m) => (typeof m.content === "string" ? m.content : ""))
          .join("\n")
      : "";
  const userPrompt =
    Array.isArray(parsed.messages)
      ? (parsed.messages as Array<{ role?: string; content?: unknown }>)
          .filter((m) => m?.role === "user")
          .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
          .join("\n")
      : "";
  const haystack = `${systemPrompt}\n${userPrompt}`.toLowerCase();
  const hasTools = Array.isArray(parsed.tools) && (parsed.tools as unknown[]).length > 0;

  // analyze_garment — enrich / fast / full modes. The function parses
  // `message.content` as JSON (via cleanJsonResponse). When the request
  // includes a tools array, tool_calls[0].function.arguments is preferred
  // by parseBursAIProviderResponse; otherwise the content string is parsed.
  // Both cases are covered below: tool_calls when tools are present, JSON
  // content otherwise. The garment schema matches `buildEnrichMessages` +
  // `buildFastMessages` / `buildFullMessages` shape so the consumer can
  // persist without further massaging.
  const garmentPayload = {
    title: "Smoke Test Garment",
    category: "top",
    subcategory: "t-shirt",
    color_primary: "navy",
    color_secondary: null,
    pattern: "solid",
    material: "cotton",
    fit: "regular",
    season_tags: ["spring", "summer"],
    formality: 2,
    confidence: 0.9,
    neckline: "crew",
    sleeve_length: "short",
    garment_length: "regular",
    silhouette: "fitted",
    style_archetype: "minimalist",
    style_tags: ["timeless", "essential"],
    occasion_tags: ["work", "weekend"],
    layering_role: "base",
    versatility_score: 8,
    color_description: "deep navy",
  };
  // Careful: "silhouette" on its own appears in the shared BURS voice
  // identity ("You think in terms of silhouette, proportion, texture..."),
  // so matching on it alone fires the garment branch for every other
  // consumer. We need signals specific to analyze_garment:
  //   - "Fashion garment analyzer" — buildFastMessages opening line
  //   - "You are a fashion expert analyzing garments" — buildFullMessages
  //   - "elite fashion stylist analyzing a garment image" — buildEnrichMessages
  if (
    /fashion garment analyzer|fashion expert analyzing|elite fashion stylist analyzing a garment image|analyze this garment/i.test(
      haystack,
    )
  ) {
    if (hasTools) {
      return openAIToolCallResponse(garmentPayload);
    }
    return openAIResponse(JSON.stringify(garmentPayload), model);
  }

  // visual_search — returns a matches array under structured content.
  //
  // Extract every UUID in the full prompt (visual_search puts the wardrobe
  // block in the SYSTEM message as `ID:<uuid> | <title> | ...` lines, not
  // the user message — we scan `haystack` which already concatenates both
  // roles) and echo them back as one match each. That lets the smoke test
  // assert the wardrobe it seeded was actually forwarded — including
  // `in_laundry: true` garments, which visual_search must not filter out.
  // If the function ever adds an `in_laundry = false` filter, the in_laundry
  // garment won't appear in the prompt, its UUID won't be echoed, and the
  // test fails loudly.
  if (/visual.search|matches|outfit.?match/i.test(haystack)) {
    const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
    const forwardedIds = Array.from(new Set(haystack.match(uuidRegex) ?? []));
    const matches = forwardedIds.length > 0
      ? forwardedIds.map((id, i) => ({
          garment_id: id,
          detected_item: `mock item ${i + 1}`,
          confidence: 90,
          reason: "close match by color and category (smoke mock)",
        }))
      : [
          // Fallback — no wardrobe IDs found (older callers). Preserves the
          // prior empty-but-structurally-valid shape so nothing downstream
          // crashes when nothing is forwarded.
          { garment_id: null, score: 0.8, reason: "close match by color and category (smoke mock)" },
        ];
    const matchesPayload = {
      matches,
      gaps: [],
      description: "smoke mock visual search result",
    };
    return openAIResponse(JSON.stringify(matchesPayload), model);
  }

  // travel_capsule — capsule_items + outfits + packing_tips.
  //
  // Per the `create_travel_capsule` tool schema, `capsule_items` is an array
  // of STRINGS (garment UUIDs), not an array of objects. The prompt body
  // carries the wardrobe block "• <Title> [ID:<uuid>] (category, ...)" so we
  // parse those UUIDs out and reuse them across capsule + outfits. Returning
  // real IDs means `resolveId` finds them in `validIds` and doesn't fall
  // into the deterministic fallback (which obscures whether the mock worked).
  if (/travel|capsule|packing|destination/i.test(haystack)) {
    // Each consumer prompt formats its wardrobe differently:
    //   - travel_capsule: `<uuid>|<category>|<title>|...` per line
    //   - burs_style_engine / visual_search: `ID:<uuid>` or `[ID:<uuid>]`
    // Extract from either format.
    const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
    const idMatches = Array.from(new Set(userPrompt.match(uuidRegex) ?? []));
    const firstIds = idMatches.slice(0, 3);
    const ensureId = (i: number) => firstIds[i] ?? firstIds[0] ?? "smoke-fallback-id";
    const capsulePayload = {
      capsule_items: firstIds,
      outfits: [
        {
          day: 1,
          date: "2026-06-01",
          kind: "trip_day",
          occasion: "sightseeing",
          items: [ensureId(0), ensureId(1), ensureId(2)],
          note: "",
        },
        {
          day: 2,
          date: "2026-06-02",
          kind: "trip_day",
          occasion: "dinner",
          items: [ensureId(0), ensureId(1), ensureId(2)],
          note: "",
        },
      ],
      packing_tips: ["Layer for evenings", "Pack light — laundry available"],
      total_combinations: 2,
      reasoning: "smoke mock capsule",
    };
    if (hasTools) {
      return openAIToolCallResponse(capsulePayload, "create_travel_capsule", model);
    }
    return openAIResponse(JSON.stringify(capsulePayload), model);
  }

  // burs_style_engine / generate_outfit / style_chat refine — outfit JSON.
  // When the request includes a tool (select_outfit / suggest_outfits), we
  // return tool_calls matching that tool's argument schema. Otherwise we
  // return a plain content JSON that any consumer can parse.
  if (/outfit|slot|stylist|ensemble|wardrobe|look|candidates/i.test(haystack)) {
    if (hasTools) {
      // burs_style_engine generates one tool per request with either
      // `select_outfit` (generate mode) or `suggest_outfits` (suggest mode).
      const toolsArr = parsed.tools as Array<{ function?: { name?: string } }>;
      const toolName = toolsArr[0]?.function?.name || "select_outfit";
      if (toolName === "suggest_outfits") {
        return openAIToolCallResponse(
          {
            suggestions: [
              {
                combo_index: 0,
                title: "Smoke mock outfit A",
                explanation: "smoke mock",
                occasion: "casual",
              },
            ],
          },
          toolName,
          model,
        );
      }
      return openAIToolCallResponse(
        {
          chosen_index: 0,
          explanation: "smoke mock explanation for the first candidate.",
        },
        toolName,
        model,
      );
    }
    const outfitPayload = {
      outfits: [
        {
          occasion: "casual",
          style_vibe: "minimalist",
          explanation: "smoke mock outfit",
          confidence_score: 0.85,
          confidence_level: "high",
          items: [
            { slot: "top", garment_id: null },
            { slot: "bottom", garment_id: null },
            { slot: "shoes", garment_id: null },
          ],
        },
      ],
      reply: "Here's a smoke-mock outfit.",
      reasoning: "smoke mock",
    };
    return openAIResponse(JSON.stringify(outfitPayload), model);
  }

  // Fallback — short plain text. Shopping_chat / style_chat conversational
  // paths fall here and treat content as a plain reply.
  return openAIResponse("This is a smoke-mock reply from the mock Gemini server.", model);
}

// Build an SSE stream body that matches OpenAI's streaming response format.
// The BURS streaming consumer pipes the upstream body straight through (see
// `streamBursAI`), so the client sees the raw SSE chunks.
function buildChatCompletionStreamBody(): string {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = "gemini-2.5-flash-lite";
  const chunks = [
    { role: "assistant", content: "Smoke " },
    { content: "mock " },
    { content: "reply." },
  ];
  const serialized = chunks
    .map((delta) =>
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: null }],
      })}\n\n`
    )
    .join("");
  const doneChunk =
    `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    })}\n\n` +
    `data: [DONE]\n\n`;
  return serialized + doneChunk;
}

// ─── Gemini native generateContent response shapes ───────────

// Used by render-eligibility (text-only gate). The gate parses
// candidates[0].content.parts[0].text as JSON.
function buildGenerateContentTextBody(): string {
  return JSON.stringify({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            {
              text: JSON.stringify({
                decision: "render",
                confidence: 0.9,
                reason: "smoke mock — accept for render",
                signals: {
                  singleGarment: true,
                  multipleGarments: false,
                  personOrBodyVisible: false,
                  handsVisible: false,
                  cleanPlainBackground: true,
                  productPhotoFraming: false,
                  alreadyProductReady: false,
                  messyEnvironment: false,
                },
              }),
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30, totalTokenCount: 40 },
  });
}

// Used by gemini-image-client. The client parses
// candidates[0].content.parts[*].inlineData.{mimeType,data} as the output PNG.
// A 1x1 transparent PNG byte sequence is sufficient for the happy-path.
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function buildGenerateContentImageBody(): string {
  return JSON.stringify({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: TINY_PNG_BASE64,
              },
            },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 0, totalTokenCount: 20 },
  });
}

// ─── Route exports ───────────────────────────────────────────

export const geminiRoutes: MockRoute[] = [
  // OpenAI-compatible chat completions. Serves both streaming (shopping_chat,
  // style_chat quick-reply path) and non-streaming (everything else).
  {
    method: "POST",
    // Matches the full OpenAI-compatible path. The mock-server strips no
    // prefix, so this matches what the edge functions fetch directly when
    // `GEMINI_URL_OVERRIDE=http://<mock>/v1beta/openai/chat/completions`.
    pathPattern: /\/v1beta\/openai\/chat\/completions/,
    response: {
      type: "dynamic",
      handler: (_req, body) => {
        let streamMode = false;
        try {
          streamMode = Boolean(JSON.parse(body)?.stream);
        } catch {
          // ignore — default non-stream
        }
        if (streamMode) {
          return {
            status: 200,
            contentType: "text/event-stream",
            body: buildChatCompletionStreamBody(),
          };
        }
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildChatCompletionResponse(body)),
        };
      },
    },
  },
  // Native Gemini generateContent — matches image-gen AND text gate. The two
  // share the same URL pattern differentiated only by model name in the path;
  // we branch on that.
  {
    method: "POST",
    pathPattern: /\/v1beta\/models\/[^/]+:generateContent/,
    response: {
      type: "dynamic",
      handler: (req) => {
        const url = req.url ?? "";
        const isImageModel = /flash-image/.test(url);
        return {
          status: 200,
          contentType: "application/json",
          body: isImageModel ? buildGenerateContentImageBody() : buildGenerateContentTextBody(),
        };
      },
    },
  },
];
