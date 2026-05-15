import { serve } from "https://deno.land/std@0.220.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callBursAI, BursAIError } from "../_shared/burs-ai.ts";

import { corsHeadersFor } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError, rateLimitResponse, checkOverload, overloadResponse, enforceSubscription, subscriptionLockedResponse } from "../_shared/scale-guard.ts";
import {
  FAST_SCHEMA,
  FULL_SCHEMA,
  ENRICH_SCHEMA,
  isSupportedLocale,
  type SupportedLocale,
} from "./schemas.ts";
import { ensureCachedContent } from "../_shared/gemini-cache.ts";

interface AnalyzeRequest {
  storagePath?: string;
  base64Image?: string;
  locale?: string;
  mode?: 'fast' | 'full' | 'enrich';
}

// S-B.4 — explicit `SupportedLocale` union keyed by `TITLE_LANG_MAP`.
// Keys MUST be kept in sync with `SUPPORTED_LOCALES` in `./schemas.ts`;
// `as const satisfies Record<SupportedLocale, string>` flags any drift at
// deno-check time before it can reach production.
const TITLE_LANG_MAP = {
  sv: 'kort beskrivande titel på svenska (max 30 tecken)',
  en: 'short descriptive title in English (max 30 characters)',
  no: 'kort beskrivende tittel på norsk (maks 30 tegn)',
  da: 'kort beskrivende titel på dansk (maks 30 tegn)',
  fi: 'lyhyt kuvaava otsikko suomeksi (enintään 30 merkkiä)',
  de: 'kurzer beschreibender Titel auf Deutsch (max 30 Zeichen)',
  fr: 'titre descriptif court en français (max 30 caractères)',
  es: 'título descriptivo corto en español (máx. 30 caracteres)',
  pt: 'título descritivo curto em português (máx. 30 caracteres)',
  it: 'titolo descrittivo breve in italiano (max 30 caratteri)',
  nl: 'korte beschrijvende titel in het Nederlands (max 30 tekens)',
  ar: 'عنوان وصفي قصير بالعربية (بحد أقصى 30 حرفًا)',
  fa: 'عنوان توصیفی کوتاه به فارسی (حداکثر ۳۰ نویسه)',
  ja: '日本語の短い説明タイトル（最大30文字）',
  pl: 'krótki opisowy tytuł po polsku (maks. 30 znaków)',
} as const satisfies Record<SupportedLocale, string>;

interface DetectedGarment {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary: string | null;
  pattern: string | null;
  material: string | null;
  fit: string | null;
  season_tags: string[];
  formality: number;
  confidence: number | null;
}

interface GarmentAnalysis {
  title: string;
  category: string;
  subcategory: string;
  color_primary: string;
  color_secondary?: string | null;
  pattern?: string | null;
  material?: string | null;
  fit?: string | null;
  season_tags: string[];
  formality: number;
  confidence?: number;
  // Wave 8 PR 2 deno-check fix (Fix Protocol exception A) — these
  // multi-garment-detection fields were used by the runtime mapping
  // logic at lines 437-471 but never declared on the interface. Latent
  // drift from a prior unrelated PR; surfaced by CI deno-check after
  // this PR's `enforceSubscription` injection touched the file. The
  // base GarmentAnalysis fields use partial-optional (`?: string | null`)
  // because they tolerate missing keys from parse-then-fallback paths;
  // the DetectedGarment sub-shape uses required-nullable because the
  // .map() always sets every field explicitly.
  image_contains_multiple_garments?: boolean;
  // detected_garments items typed as `unknown` so the existing
  // `.filter((item) => item && typeof item === 'object')` +
  // `item as Record<string, unknown>` defensive re-validation
  // pattern stays valid. Using `DetectedGarment[]` here would
  // make the cast invalid (DetectedGarment has no index signature).
  // The DetectedGarment interface remains for external consumers
  // who want a name for the response shape (since `analysis.detected_garments`
  // is assigned the well-typed `detectedGarments` array of DetectedGarment).
  detected_garments?: unknown[];
}

function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();
  const categoryMap: Record<string, string> = {
    'top': 'top', 'överdel': 'top', 'tröja': 'top', 'skjorta': 'top',
    't-shirt': 'top', 'blus': 'top',
    'bottom': 'bottom', 'underdel': 'bottom', 'byxa': 'bottom',
    'byxor': 'bottom', 'jeans': 'bottom', 'kjol': 'bottom',
    'shoes': 'shoes', 'skor': 'shoes', 'sko': 'shoes',
    'outerwear': 'outerwear', 'ytterkläder': 'outerwear',
    'jacka': 'outerwear', 'kappa': 'outerwear',
    'accessory': 'accessory', 'accessoar': 'accessory', 'väska': 'accessory',
    'dress': 'dress', 'klänning': 'dress',
  };
  return categoryMap[catLower] || 'top';
}

function normalizeColor(color: string): string {
  const colorLower = color.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    'black': 'black', 'white': 'white', 'grey': 'grey', 'gray': 'grey',
    'blue': 'blue', 'navy': 'navy', 'beige': 'beige', 'cream': 'beige',
    'brown': 'brown', 'green': 'green', 'red': 'red', 'pink': 'pink',
    'purple': 'purple', 'yellow': 'yellow', 'orange': 'orange',
    'svart': 'black', 'vit': 'white', 'vitt': 'white',
    'grå': 'grey', 'grått': 'grey',
    'blå': 'blue', 'blått': 'blue',
    'marinblå': 'navy', 'marin': 'navy',
    'kräm': 'beige',
    'brun': 'brown', 'brunt': 'brown',
    'grön': 'green', 'grönt': 'green',
    'röd': 'red', 'rött': 'red',
    'rosa': 'pink',
    'lila': 'purple', 'violet': 'purple',
    'gul': 'yellow', 'gult': 'yellow',
  };
  return colorMap[colorLower] || colorLower;
}

function normalizeSeasonTags(tags: string[]): string[] {
  const normalized: Set<string> = new Set();
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (tagLower.includes('summer') || tagLower.includes('sommar')) {
      normalized.add('summer');
    } else if (tagLower.includes('winter') || tagLower.includes('vinter')) {
      normalized.add('winter');
    } else if (tagLower.includes('spring') || tagLower.includes('vår') ||
               tagLower.includes('autumn') || tagLower.includes('fall') || tagLower.includes('höst')) {
      normalized.add('spring');
      normalized.add('autumn');
    } else if (tagLower.includes('all') || tagLower.includes('year') || tagLower.includes('året')) {
      normalized.add('spring'); normalized.add('summer');
      normalized.add('autumn'); normalized.add('winter');
    }
  }
  if (normalized.size === 0) return ['spring', 'summer', 'autumn', 'winter'];
  return Array.from(normalized);
}

function normalizeFormality(formality: number): number {
  return Math.max(1, Math.min(5, Math.round(formality)));
}

// ─── Prompts ──────────────────────────────────────────────────
//
// With Gemini structured output (S-B.1) the schema (in ./schemas.ts) is
// the contract — the prompt no longer needs to enumerate every enum
// value or beg "JSON only, no explanatory text". This shaves ~150-200
// tokens off every fast-mode prompt and ~400 off enrich, the savings
// the wave file budgets for.

// Fast mode — minimal instruction, schema does the typing.
function buildFastMessages(imageUrl: string, titleInstruction: string) {
  return [
    {
      role: 'system',
      content: `Fashion garment analyzer. For "title", return ${titleInstruction}. For "subcategory", give the specific garment type in English (e.g. t-shirt, jeans, sneakers, jacket).
confidence rules: 0.90-1.0 only when category, color, and type are completely unambiguous. 0.65-0.89 when garment is partially visible, background is busy, or category is somewhat uncertain. Below 0.65 when dark, blurry, or multiple items visible. Never default to 0.9.`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this garment.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    },
  ];
}

// Full mode — fashion expert with multi-garment detection.
function buildFullMessages(imageUrl: string, titleInstruction: string) {
  return [
    {
      role: 'system',
      content: `You are a fashion expert analyzing garments from images. For "title", return ${titleInstruction}. For "subcategory", give the specific garment type in English (e.g. t-shirt, jeans, sneakers, jacket).
Formality: 1=very casual, 5=very formal. Confidence: 0-1.
Set image_contains_multiple_garments=true if the photo clearly contains more than one distinct garment that could be added separately, and populate detected_garments with one entry per distinct garment. Otherwise set image_contains_multiple_garments=false and return an empty detected_garments array.`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this garment.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    },
  ];
}

// Enrich mode — system prompt is cached server-side (S-B.2). The schema
// in ./schemas.ts pins the response shape; the prompt focuses on
// stylist-level interpretation guidance the schema can't encode.
//
// ENRICH_SYSTEM_PROMPT is exported separately so `_shared/gemini-cache.ts`
// can warm the cache with the exact string the model will see; if the two
// drift, Gemini's cache hash misses and the discount is lost.
export const ENRICH_SYSTEM_PROMPT = `You are an elite fashion stylist analyzing a garment image for deep intelligence.

versatility_score: 1-10 (1=very specific, 10=ultimate wardrobe staple).
confidence: 0-1 (how confident you are in this analysis).

For rise / leg_shape / waistband — leave null when the garment is not a bottom.
For text_on_garment / logo_description / graphic_or_print_description — leave null when the garment is plain or has only a simple repeating pattern.
For color_description — provide the precise color name beyond the basic palette (e.g. 'pale sage green', 'washed indigo', 'off-white cream', 'heather grey'); match exactly what is visible.
For occasion_tags — choose from: work, weekend, evening, sport, date, travel, formal, lounge.
For style_tags — up to 5 descriptors. For care_instructions — up to 3 short tips.
For stylist_note — one sentence on how a real stylist would use this piece.
For color_harmony_notes — what tones pair well.
For refined_title — improved concise title (max 30 chars).`;

// When `withSystemMessage` is false, the system instruction is assumed to
// be carried by Gemini's `cached_content` payload. Sending it again per
// request causes Gemini to reject (or ignore) the cached content — every
// enrich call would fall through to the catch path and return
// `{ enrichment: null }`. The cache-miss path keeps the inline system
// message so correctness holds without the discount.
function buildEnrichMessages(imageUrl: string, withSystemMessage = true) {
  const userMessage = {
    role: 'user',
    content: [
      { type: 'text', text: 'Provide deep garment intelligence.' },
      { type: 'image_url', image_url: { url: imageUrl } },
    ],
  };
  if (!withSystemMessage) {
    return [userMessage];
  }
  return [
    {
      role: 'system',
      content: ENRICH_SYSTEM_PROMPT,
    },
    userMessage,
  ];
}

// Wave S-A.3 (2026-05-15): base64 image format validator.
//
// Returns { ok: true } when the data URL declares an allowed MIME and the
// decoded prefix matches its magic header. Returns { ok: false, reason }
// otherwise. Rejection paths are concise — callers map every failure to
// HTTP 400 invalid_image_format.
const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function validateBase64Image(input: string): { ok: true } | { ok: false; reason: string } {
  if (!input.startsWith('data:')) {
    return { ok: false, reason: 'missing_data_url_prefix' };
  }
  const commaIdx = input.indexOf(',');
  if (commaIdx === -1) {
    return { ok: false, reason: 'malformed_data_url' };
  }
  const header = input.slice(5, commaIdx); // strip "data:" prefix
  let mime = header.split(';')[0].trim().toLowerCase();
  // Normalize the `image/jpg` alias to `image/jpeg`. `import_garments_from_links`
  // preserves whatever Content-Type the upstream shop returned, and many CDNs
  // serve JPEGs as `image/jpg`. Treat them as equivalent here so those imports
  // still classify (Codex P2 on #849).
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    return { ok: false, reason: 'unsupported_mime' };
  }

  // Decode the first ~16 bytes for magic-byte inspection. atob on a short
  // base64 prefix is cheap; we only need 12 bytes for WebP's RIFF+WEBP
  // signature, less for JPEG/PNG.
  const body = input.slice(commaIdx + 1);
  // 24 base64 chars → 18 raw bytes, enough for any of the three magic
  // sequences below with margin.
  const sample = body.slice(0, 24);
  let bytes: Uint8Array;
  try {
    const decoded = atob(sample);
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  } catch {
    return { ok: false, reason: 'invalid_base64' };
  }
  if (bytes.length < 4) {
    return { ok: false, reason: 'truncated_payload' };
  }

  // JPEG: FF D8 FF
  if (mime === 'image/jpeg') {
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return { ok: true };
    return { ok: false, reason: 'magic_byte_mismatch' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === 'image/png') {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return { ok: true };
    return { ok: false, reason: 'magic_byte_mismatch' };
  }
  // WebP: "RIFF" (52 49 46 46) ... "WEBP" (57 45 42 50) at offset 8
  if (mime === 'image/webp') {
    if (
      bytes.length >= 12
      && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return { ok: true };
    return { ok: false, reason: 'magic_byte_mismatch' };
  }
  return { ok: false, reason: 'unsupported_mime' };
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = user.id;

    const { storagePath, base64Image, locale, mode = 'full' } = await req.json() as AnalyzeRequest;

    // S-B.4 — strict locale validation. Unknown locale → 400 (no silent
    // fallback to English; a future feature could legitimately key off
    // locale and an unchecked fallback would mask the misconfiguration).
    // `undefined` / missing locale → default 'en' (preserves the prior
    // contract for callers that never sent one).
    let resolvedLocale: SupportedLocale;
    if (locale == null) {
      resolvedLocale = 'en';
    } else if (isSupportedLocale(locale)) {
      resolvedLocale = locale;
    } else {
      return new Response(
        JSON.stringify({ error: "unsupported_locale" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const titleInstruction = TITLE_LANG_MAP[resolvedLocale];

    if (!storagePath && !base64Image) {
      return new Response(
        JSON.stringify({ error: "storagePath or base64Image is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (storagePath && !storagePath.startsWith(`${userId}/`)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (base64Image && base64Image.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Image is too large" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Wave S-A.3 (2026-05-15): base64 MIME + magic-byte validation.
    //
    // Before this, the function accepted up to 5 MB of arbitrary base64
    // with no format check, then forwarded it to Gemini as an image URL.
    // An attacker could ship a base64-encoded PDF / SVG / arbitrary blob
    // and burn the user's rate-limit / monthly-cost budget on a payload
    // the model can't process anyway.
    //
    // Rules:
    //   - data: prefix must be present and parseable
    //   - declared MIME must be image/jpeg, image/png, or image/webp
    //   - first decoded bytes must match the declared MIME's magic header
    //
    // Rejections return HTTP 400 invalid_image_format and short-circuit
    // BEFORE the rate-limit / subscription / overload gates so a bad
    // payload never spends quota.
    if (base64Image) {
      const validation = validateBase64Image(base64Image);
      if (!validation.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: 'invalid_image_format', reason: validation.reason }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Scale guard ──
    if (checkOverload("analyze_garment")) {
      return overloadResponse(corsHeaders);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    await enforceRateLimit(serviceClient, userId, "analyze_garment");

    // Wave 8 P54 — paywall gate. Onboarding-plan users bypass via the
    // resolveUserPlan check inside enforceSubscription.
    const subCheck = await enforceSubscription(serviceClient, userId);
    if (!subCheck.allowed) {
      return subscriptionLockedResponse(subCheck.reason, corsHeaders);
    }

    // Resolve image URL
    let resolvedImageUrl: string;
    if (base64Image) {
      resolvedImageUrl = base64Image;
    } else {
      // Wave S-A.5 (2026-05-15, revised 2026-05-16): keep the 300s TTL.
      // The initial S-A.5 pass dropped this to 60s for blast-radius reduction,
      // but `callBursAI` runs up to 2 attempts × 2 models (≈4× the per-attempt
      // timeout) and enrich mode can retry the whole call after a parse
      // failure. With a 20s enrich timeout, later attempts can start at/after
      // the 60s mark and Gemini would fetch an expired URL. 300s leaves ample
      // slack for the full retry chain while still bounding leak risk (Codex
      // P2 on #849).
      const { data: signedData, error: signedError } = await serviceClient.storage
        .from('garments')
        .createSignedUrl(storagePath!, 300);
      if (signedError || !signedData?.signedUrl) {
        return new Response(
          JSON.stringify({ error: "Could not fetch image" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      resolvedImageUrl = signedData.signedUrl;
    }

    // ─── Enrich mode: return enrichment data only ───
    if (mode === 'enrich') {
      // S-B.2 — warm / reuse the explicit Gemini cache for the enrich
      // system prompt. Returns null on any error; we then issue an un-
      // cached request rather than 5xx the user. Lazy: first enrich call
      // after a deploy creates the cache (adds ~300ms to that call);
      // subsequent calls reference it.
      //
      // ENRICH_MODEL is pinned to `gemini-2.5-flash` because explicit
      // `cachedContents` is documented for flash and is NOT documented
      // for flash-lite (the default `standard` complexity chain). The
      // pin both guarantees cache support and prevents a silent
      // discount-disabled fallback to flash-lite. The non-cached cost
      // of one model call on flash vs flash-lite is marginal compared
      // to the 90% cached-token discount we get on every enrich call.
      const ENRICH_MODEL = "gemini-2.5-flash";
      const cacheName = await ensureCachedContent(serviceClient, {
        purpose: "analyze_garment_enrich_v1",
        model: ENRICH_MODEL,
        systemInstruction: ENRICH_SYSTEM_PROMPT,
      });

      try {
        const { data } = await callBursAI({
          models: [ENRICH_MODEL],
          max_tokens: 800,
          timeout: 20000,
          functionName: "analyze_garment_enrich",
          // When cached_content is attached, the system prompt lives in
          // the cache itself; sending it again per-request causes Gemini
          // to reject/ignore the cached content. See buildEnrichMessages.
          messages: buildEnrichMessages(resolvedImageUrl, !cacheName),
          extraBody: { temperature: 0.1 },
          responseFormat: ENRICH_SCHEMA,
          ...(cacheName ? { cachedContent: cacheName } : {}),
        }, serviceClient);

        // S-B.3 — Gemini structured output guarantees schema-valid JSON,
        // so the legacy parse-retry codepath is gone. `data` is a string
        // (model content) whose JSON.parse yields the schema-typed shape.
        const enrichment: Record<string, unknown> = typeof data === 'string'
          ? JSON.parse(data)
          : (data as Record<string, unknown>);

        return new Response(
          JSON.stringify({ enrichment, ai_provider: 'burs_ai' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        // Structured output makes JSON.parse failure effectively
        // impossible, but a network / provider error still surfaces
        // here. Preserve the prior "enrichment: null" 200 contract so
        // the mobile client's fallback path continues to work.
        const sample = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
        console.error('Enrichment error:', sample);
        return new Response(
          JSON.stringify({ enrichment: null, error: "enrich_failed", ai_provider: 'burs_ai' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ─── Fast or Full mode ───
    const isFast = mode === 'fast';
    const messages = isFast
      ? buildFastMessages(resolvedImageUrl, titleInstruction)
      : buildFullMessages(resolvedImageUrl, titleInstruction);

    let content: string;
    try {
      const { data } = await callBursAI({
        complexity: isFast ? "trivial" : "standard",
        max_tokens: isFast ? 200 : 500,
        timeout: isFast ? 10000 : 30000,
        functionName: "analyze_garment",
        messages,
        extraBody: isFast ? { temperature: 0 } : undefined,
        // S-B.1 — structured output. Gemini guarantees schema-valid JSON;
        // the legacy markdown-fence cleanup below is now dead-but-cheap
        // and retained as belt-and-braces for the next 1-2 deploys (it
        // can be removed once telemetry shows no fence appearances).
        responseFormat: isFast ? FAST_SCHEMA : FULL_SCHEMA,
      }, serviceClient);

      content = typeof data === 'string' ? data : JSON.stringify(data);
    } catch (aiErr) {
      if (aiErr instanceof BursAIError) {
        if (aiErr.status === 429) {
          return new Response(
            JSON.stringify({ error: "Too many requests, try again later" }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiErr.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted, contact support" }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      if (aiErr instanceof Error && aiErr.message.includes('timed out')) {
        return new Response(
          JSON.stringify({ error: "AI analysis timed out" }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('AI analysis error:', aiErr);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawAnalysis: GarmentAnalysis;
    try {
      // S-B.1: structured output guarantees a JSON-parseable string with
      // all required fields. The markdown-fence strip + missing-field
      // throw below remain as belt-and-braces for the 1-2 deploy windows
      // immediately after rollout, when a hypothetical Gemini-side
      // regression could surface fenced output. Both are cheap (single
      // regex + 3 boolean checks) so the safety margin is free.
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      rawAnalysis = JSON.parse(cleanedContent);
      if (!rawAnalysis.title || !rawAnalysis.category || !rawAnalysis.color_primary) {
        throw new Error('Missing required fields');
      }
    } catch (parseError) {
      // Wave S-A.5 (2026-05-15): scrub the full AI response body from logs.
      // Garment images can carry text-on-garment captures, and a parse-failure
      // log line that prints the entire AI response leaks that content into
      // Supabase logs. Keep length + leading sample for debuggability;
      // never the full payload.
      console.error('Failed to parse AI response:', parseError, {
        length: content?.length ?? 0,
        sample: content?.slice(0, 80) ?? '',
      });
      return new Response(
        JSON.stringify({ error: "Could not parse AI response" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedTitle = rawAnalysis.title.substring(0, 50);
    const normalizedCategory = normalizeCategory(rawAnalysis.category);
    const normalizedColorPrimary = normalizeColor(rawAnalysis.color_primary);
    const normalizedSeasonTags = normalizeSeasonTags(rawAnalysis.season_tags || []);
    const normalizedFormality = normalizeFormality(rawAnalysis.formality || 3);
    // S-B.1 — strict schema requires `detected_garments` always present
    // (empty array when no multi-garment detection). Coerce empty arrays
    // back to `undefined` so the response shape matches the pre-S-B
    // contract for mobile clients that conditionally render this field.
    const rawDetected = Array.isArray(rawAnalysis.detected_garments) && rawAnalysis.detected_garments.length > 0
      ? rawAnalysis.detected_garments
      : null;
    const detectedGarments = rawDetected
      ? rawDetected
          .filter((item) => item && typeof item === 'object')
          .map((item) => {
            const garment = item as Record<string, unknown>;
            return {
              title: typeof garment.title === 'string' ? garment.title.substring(0, 50) : normalizedTitle,
              category: normalizeCategory(typeof garment.category === 'string' ? garment.category : rawAnalysis.category),
              subcategory: typeof garment.subcategory === 'string' ? garment.subcategory.toLowerCase() : '',
              color_primary: normalizeColor(typeof garment.color_primary === 'string' ? garment.color_primary : rawAnalysis.color_primary),
              color_secondary: typeof garment.color_secondary === 'string' ? normalizeColor(garment.color_secondary) : null,
              pattern: typeof garment.pattern === 'string' ? garment.pattern.toLowerCase() : null,
              material: typeof garment.material === 'string' ? garment.material.toLowerCase() : null,
              fit: typeof garment.fit === 'string' ? garment.fit.toLowerCase() : null,
              season_tags: normalizeSeasonTags(Array.isArray(garment.season_tags) ? garment.season_tags.filter((tag): tag is string => typeof tag === 'string') : []),
              formality: normalizeFormality(typeof garment.formality === 'number' ? garment.formality : rawAnalysis.formality || 3),
              confidence: typeof garment.confidence === 'number' ? Math.max(0, Math.min(1, garment.confidence)) : null,
            };
          })
      : undefined;

    const analysis: GarmentAnalysis = {
      title: normalizedTitle,
      category: normalizedCategory,
      subcategory: rawAnalysis.subcategory?.toLowerCase() || '',
      color_primary: normalizedColorPrimary,
      color_secondary: rawAnalysis.color_secondary ? normalizeColor(rawAnalysis.color_secondary) : null,
      pattern: rawAnalysis.pattern?.toLowerCase() || null,
      material: rawAnalysis.material?.toLowerCase() || null,
      fit: rawAnalysis.fit?.toLowerCase() || null,
      season_tags: normalizedSeasonTags,
      formality: normalizedFormality,
      confidence: typeof rawAnalysis.confidence === 'number' ? Math.max(0, Math.min(1, rawAnalysis.confidence)) : undefined,
      image_contains_multiple_garments: rawAnalysis.image_contains_multiple_garments === true,
      detected_garments: detectedGarments,
    };

    return new Response(
      JSON.stringify({ ...analysis, ai_provider: 'burs_ai', ai_raw: rawAnalysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return rateLimitResponse(error, corsHeaders);
    }
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
