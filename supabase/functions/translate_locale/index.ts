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
import { placeholderSetsMatch } from "./placeholders.ts";

export const SUPPORTED_TARGET_LOCALES = [
  "ar", "da", "de", "es", "fa", "fi", "fr", "it", "nl", "no", "pl", "pt",
] as const;
export type TargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number];

export const MAX_KEYS_PER_REQUEST = 200;

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

  const expected = getSecret();
  const got = req.headers.get("x-translate-secret") ?? "";
  if (!expected || got !== expected) return json(401, { error: "unauthorized" });

  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return json(400, { error: "malformed json" });
  }

  if (!SUPPORTED_TARGET_LOCALES.includes(body.target_locale as TargetLocale)) {
    return json(400, { error: `unsupported target_locale: ${body.target_locale}` });
  }
  const keys = body.source_keys ?? {};
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
  // keeps the parser trivial.
  const systemPrompt =
    `You are a senior translator for a fashion/wardrobe app called BURS.
The Swedish dictionary below is hand-curated and establishes the brand voice (terse, premium, minimal, sentence case).
Translate the source dictionary to ${body.target_locale}, matching that register.
Hard rules:
- Preserve every {placeholder} token EXACTLY (same name, same braces).
- Preserve sentence case (do not Title Case strings).
- Never invent keys or omit keys from the source.
- Output JSON only, no commentary, of shape: {"translations": {"<key>": "<translation>"}}.`;

  const userPrompt = JSON.stringify({
    target_locale: body.target_locale,
    sv_anchor: body.sv_reference,
    source: keys,
  });

  let aiData: unknown;
  try {
    const result = await callBursAI({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      complexity: "standard",
      functionName: "translate_locale",
    });
    aiData = result.data;
  } catch (err) {
    return json(502, {
      error: "translate_locale: gemini call failed",
      detail: String(err),
    });
  }

  // Gemini returns the JSON object directly (data: any) or a string. Try
  // both: if it's already an object, use it; otherwise JSON.parse the string.
  let parsed: { translations?: Record<string, string> };
  try {
    if (typeof aiData === "string") {
      parsed = JSON.parse(aiData);
    } else if (aiData && typeof aiData === "object") {
      parsed = aiData as { translations?: Record<string, string> };
    } else {
      return json(502, { error: "translate_locale: empty response from gemini" });
    }
  } catch {
    return json(502, { error: "translate_locale: malformed JSON from gemini" });
  }
  const aiTranslations = parsed.translations ?? {};

  // Placeholder guard: any translation whose {xxx} set differs from the
  // source falls back to the English passthrough. Better than shipping
  // `Bonjour {nom}` when t('greet', { name: 'X' }) won't substitute.
  const translations: Record<string, string> = {};
  const missing: string[] = [];
  for (const k of Object.keys(keys)) {
    const src = keys[k];
    const tgt = aiTranslations[k];
    if (typeof tgt !== "string" || tgt.length === 0) {
      missing.push(k);
      continue;
    }
    if (!placeholderSetsMatch(src, tgt)) {
      translations[k] = src; // passthrough
      continue;
    }
    translations[k] = tgt;
  }

  return json(200, {
    ok: missing.length === 0,
    target_locale: body.target_locale,
    translations,
    chunk_index: body.chunk_index,
    missing_keys: missing,
  });
}

if (typeof Deno !== "undefined") {
  const { serve } = await import("https://deno.land/std@0.220.0/http/server.ts");
  serve(handleRequest);
}
