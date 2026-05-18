// translate_locale — translates a chunk of mobile/src/i18n/locales/en.ts
// into one of the 12 non-English locales using Gemini, with mobile/sv.ts
// as a brand-voice anchor. Called by mobile/scripts/translate-locales.mjs.
//
// Auth: secret header (not user JWT) because the orchestrator runs from
// a dev workstation, not a signed-in user session. Cost cap: 200 keys
// per request prevents a misconfigured caller from racking up Gemini
// bills. Tests import handleRequest directly; serve() lives behind a
// Deno-only guard so vitest under Node doesn't try to bind a port.

import { CORS_HEADERS } from "../_shared/cors.ts";
import { callBursAI } from "../_shared/burs-ai.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { placeholderSetsMatch } from "./placeholders.ts";

export const SUPPORTED_TARGET_LOCALES = [
  "ar", "da", "de", "es", "fa", "fi", "fr", "it", "nl", "no", "pl", "pt",
] as const;
export type TargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number];

export const MAX_KEYS_PER_REQUEST = 200;

// Map each supported locale code to a display name for the system prompt.
// We hand the model a phrase like "Translate to French" rather than the raw
// two-letter code, both because the model reasons better with the full name
// and to remove any user-controlled string from the prompt template (defense
// in depth — the SUPPORTED_TARGET_LOCALES allowlist is the primary guard).
const LOCALE_DISPLAY_NAMES: Record<TargetLocale, string> = {
  ar: "Arabic",
  da: "Danish",
  de: "German",
  es: "Spanish",
  fa: "Persian (Farsi)",
  fi: "Finnish",
  fr: "French",
  it: "Italian",
  nl: "Dutch",
  no: "Norwegian Bokmål",
  pl: "Polish",
  pt: "Portuguese",
};

interface TranslateRequest {
  target_locale: string;
  source_keys: Record<string, string>;
  sv_reference: Record<string, string>;
  chunk_index: number;
  total_chunks: number;
}

function getSecret(): string | undefined {
  // Tests inject via globalThis; production reads from Deno.env.
  const injected = (globalThis as Record<string, unknown>).__TRANSLATE_LOCALE_SECRET__;
  if (typeof injected === "string") return injected;
  if (typeof Deno !== "undefined") return Deno.env.get("TRANSLATE_LOCALE_SECRET") ?? undefined;
  return undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  // Constant-time secret compare. `got !== expected` would short-circuit on
  // the first mismatching byte and leak per-byte timing — narrow attack
  // surface in a dev-script context, but the helper is right there in
  // _shared/timing-safe.ts and the rest of the repo (revenuecat-signature,
  // process_render_jobs) already uses it for the same reason.
  const expected = getSecret();
  const got = req.headers.get("x-translate-secret") ?? "";
  if (!expected || !timingSafeEqual(got, expected)) {
    return json(401, { error: "unauthorized" });
  }

  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return json(400, { error: "malformed json" });
  }

  // Type-narrow target_locale before the allowlist check. Without this guard
  // a caller sending `{ target_locale: {} }` would pass the cast and end up
  // with "[object Object]" interpolated into the prompt. We validate the
  // value is a string AND on the allowlist before trusting it.
  if (typeof body.target_locale !== "string" ||
      !SUPPORTED_TARGET_LOCALES.includes(body.target_locale as TargetLocale)) {
    return json(400, { error: `unsupported target_locale: ${String(body.target_locale)}` });
  }
  const targetLocale = body.target_locale as TargetLocale;

  // Validate source_keys is a plain object of non-empty string→string entries.
  // Without this, non-string values would coerce into the prompt and the
  // renderer downstream would emit invalid JS. JSON.stringify accepts any
  // value type; the contract here is stricter.
  const rawKeys = body.source_keys;
  if (rawKeys === null || typeof rawKeys !== "object" || Array.isArray(rawKeys)) {
    return json(400, { error: "source_keys must be an object" });
  }
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawKeys)) {
    if (typeof k !== "string" || typeof v !== "string") {
      return json(400, { error: `source_keys[${String(k)}] must map string → string` });
    }
    keys[k] = v;
  }
  const count = Object.keys(keys).length;
  if (count === 0) return json(400, { error: "source_keys must be non-empty" });
  if (count > MAX_KEYS_PER_REQUEST) {
    return json(413, {
      error: `cost cap: max ${MAX_KEYS_PER_REQUEST} keys per request, got ${count}`,
    });
  }

  // sv_reference acts as a brand-voice anchor — the model sees how the
  // same keys land in Swedish (hand-curated by a native author) and is
  // asked to match the register in the target locale. JSON-only output
  // keeps the parser trivial. Target locale lands as a display name so
  // no user-controlled string reaches the prompt template.
  const targetName = LOCALE_DISPLAY_NAMES[targetLocale];
  const systemPrompt =
    `You are a senior translator for a fashion/wardrobe app called BURS.
The Swedish dictionary below is hand-curated and establishes the brand voice (terse, premium, minimal, sentence case).
Translate the source dictionary to ${targetName}, matching that register.
Hard rules:
- Preserve every {placeholder} token EXACTLY (same name, same braces).
- Preserve sentence case (do not Title Case strings).
- Never invent keys or omit keys from the source.
- Output JSON only, no commentary, of shape: {"translations": {"<key>": "<translation>"}}.`;

  const svRef = body.sv_reference && typeof body.sv_reference === "object" && !Array.isArray(body.sv_reference)
    ? body.sv_reference
    : {};
  const userPrompt = JSON.stringify({
    target_locale: targetLocale,
    sv_anchor: svRef,
    source: keys,
  });

  let aiData: unknown;
  try {
    // 80-key chunks need ~3-5k output tokens (~50 tokens per translated
    // value + JSON overhead). complexity:"standard"'s 600-token default
    // truncates mid-response — every chunk came back with unclosed
    // ```json fences during the first live run. Gemini 2.5 Flash caps
    // output at 8192 tokens regardless of the value here; setting to the
    // cap (rather than the previous 16000 which was silently clamped)
    // makes the budget honest.
    const result = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      complexity: "complex",
      max_tokens: 8192,
      functionName: "translate_locale",
    });
    aiData = result.data;
  } catch (err) {
    return json(502, {
      error: "translate_locale: gemini call failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // Gemini returns the JSON object directly (data: any) or a string.
  // Despite the prompt saying "JSON only", the model frequently wraps the
  // payload in ```json ... ``` fences or adds leading prose. Strip both.
  let parsed: { translations?: Record<string, string> };
  try {
    if (aiData && typeof aiData === "object") {
      parsed = aiData as { translations?: Record<string, string> };
    } else if (typeof aiData === "string") {
      let s = aiData.trim();
      // Strip ```json or ``` fences. Use a tolerant strip (leading + optional
      // trailing) so a truncated response with an unclosed fence still parses.
      s = s.replace(/^```(?:json)?\s*/, "");
      s = s.replace(/\s*```\s*$/, "");
      // If still not JSON-shaped, find the first { and last } and slice.
      if (!s.startsWith("{")) {
        const start = s.indexOf("{");
        const end = s.lastIndexOf("}");
        if (start >= 0 && end > start) s = s.slice(start, end + 1);
      }
      parsed = JSON.parse(s);
    } else {
      return json(502, { error: "translate_locale: empty response from gemini" });
    }
  } catch (err) {
    return json(502, {
      error: "translate_locale: malformed JSON from gemini",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  const aiTranslations = parsed.translations ?? {};

  // Placeholder guard: any translation whose {xxx} set differs from the
  // source falls back to the English passthrough. Better than shipping
  // `Bonjour {nom}` when t('greet', { name: 'X' }) won't substitute.
  // Two failure modes get surfaced separately so the orchestrator can
  // distinguish them in its log: missing_keys = the model dropped the
  // key entirely; passthrough_keys = the model emitted a value but
  // mangled the placeholder, so we substituted the English source.
  const translations: Record<string, string> = {};
  const missing: string[] = [];
  const passthrough: string[] = [];
  for (const k of Object.keys(keys)) {
    const src = keys[k];
    const tgt = aiTranslations[k];
    if (typeof tgt !== "string" || tgt.length === 0) {
      missing.push(k);
      continue;
    }
    if (!placeholderSetsMatch(src, tgt)) {
      translations[k] = src;
      passthrough.push(k);
      continue;
    }
    translations[k] = tgt;
  }

  return json(200, {
    ok: missing.length === 0,
    target_locale: targetLocale,
    translations,
    chunk_index: body.chunk_index,
    missing_keys: missing,
    passthrough_keys: passthrough,
  });
}

if (typeof Deno !== "undefined") {
  const { serve } = await import("https://deno.land/std@0.220.0/http/server.ts");
  serve(handleRequest);
}
