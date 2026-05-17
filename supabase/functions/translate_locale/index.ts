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

  // Translation call lands in Task 3. For now, echo so tests can assert shape.
  return json(200, {
    ok: true,
    target_locale: body.target_locale,
    translations: keys,
    chunk_index: body.chunk_index,
    missing_keys: [],
  });
}

if (typeof Deno !== "undefined") {
  const { serve } = await import("https://deno.land/std@0.220.0/http/server.ts");
  serve(handleRequest);
}
