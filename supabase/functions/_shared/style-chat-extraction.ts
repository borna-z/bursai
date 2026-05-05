/**
 * Wave 8.5 PR B (P89) — deterministic chat-driven preference extraction.
 *
 * Option B per `docs/launch/wave-8.5-pr-b-integration-design.md`:
 *
 *   - keyword/regex pattern matcher on the user's last chat turn
 *   - locale-scoped (en + sv at v1; other locales no-op + log)
 *   - confidence-scored emit (≥ 0.6 floor)
 *   - active_look / anchorGarmentId binding requirement for outfit-level
 *     events (prevents "I hate Mondays" from emitting a style signal)
 *
 * Integration: `style_chat` calls `extractMemoryEvents(...)` after the
 * Gemini turn responds, then dispatches successful events to
 * `_shared/style-memory-ingest.ts:ingestMemoryEvent` via
 * `EdgeRuntime.waitUntil(...)` so user-facing latency is unaffected.
 *
 * Future migration to Option C (structured-output Gemini tool-call): the
 * `extractMemoryEvents` signature is the canonical interface; swap the
 * implementation without touching call sites.
 *
 * Pure module — no Deno imports — bundles into `style_chat` AND runs
 * unmodified under vitest for unit tests.
 */

import type { CanonicalStyleMemorySignal } from "./style-memory-signals.ts";

export interface ExtractionContext {
  userTurn: string;
  locale: string;
  activeLook: { garment_ids: string[]; outfit_id?: string } | null;
  anchorGarmentId: string | null;
}

export interface ExtractedMemoryEvent {
  signal_type: CanonicalStyleMemorySignal;
  metadata: Record<string, unknown>;
  confidence: number;
  pattern_id: string;
}

/** Floor below which patterns are logged but NOT emitted. */
export const CONFIDENCE_FLOOR = 0.6;

interface Pattern {
  id: string;
  locale: "en" | "sv";
  trigger: RegExp;
  /** Negation antipattern — if matched, vetoes the trigger entirely. */
  negation?: RegExp;
  /** Returns the pre-confidence event payload, or null if context is insufficient. */
  emit(
    ctx: ExtractionContext,
  ): Omit<ExtractedMemoryEvent, "confidence" | "pattern_id"> | null;
  baseConfidence: number;
  bindingRequired: "activeLook" | "anchor" | "either" | "none";
}

const COLOR_TOKENS_EN = [
  "red",
  "blue",
  "green",
  "black",
  "white",
  "gray",
  "grey",
  "beige",
  "navy",
  "pink",
  "yellow",
  "orange",
  "purple",
  "brown",
];
const COLOR_REGEX_EN = new RegExp(
  `\\b(?:don'?t like|hate)\\s+(?:the\\s+)?(${COLOR_TOKENS_EN.join("|")})\\b`,
  "i",
);

const COLOR_TOKENS_SV = [
  "röd",
  "blå",
  "grön",
  "svart",
  "vit",
  "grå",
  "beige",
  "rosa",
  "gul",
  "orange",
  "lila",
  "brun",
];

// JavaScript `\b` is ASCII-only and fails on Swedish letters (ä, å, ö, é).
// Use Unicode-aware lookarounds with the `u` flag instead so matches don't
// silently drop on non-ASCII vocab.
const SV_BB = "(?<![\\p{L}])"; // boundary before
const SV_BA = "(?![\\p{L}])"; // boundary after

const COLOR_REGEX_SV = new RegExp(
  `${SV_BB}(?:gillar inte|hatar)\\s+(${COLOR_TOKENS_SV.join("|")})${SV_BA}`,
  "iu",
);

const PATTERNS: Pattern[] = [
  // ── EN ───────────────────────────────────────────────────────────
  {
    id: "hate_X_en",
    locale: "en",
    trigger: /\b(hate|can'?t stand|despise)\b/i,
    negation: /\b(don'?t hate|not hate)\b/i,
    emit: (ctx) => {
      const meta: Record<string, unknown> = { value: "dislike" };
      if (ctx.activeLook?.outfit_id) meta.outfit_id = ctx.activeLook.outfit_id;
      if (ctx.activeLook?.garment_ids?.length) {
        meta.garment_ids = ctx.activeLook.garment_ids;
      } else if (ctx.anchorGarmentId) {
        meta.garment_ids = [ctx.anchorGarmentId];
      }
      return { signal_type: "quick_reaction", metadata: meta };
    },
    baseConfidence: 0.7,
    bindingRequired: "either",
  },
  {
    id: "love_X_en",
    locale: "en",
    trigger: /\b(love|adore)\b/i,
    negation: /\b(don'?t love|not love)\b/i,
    emit: (ctx) => {
      const meta: Record<string, unknown> = { value: "love" };
      if (ctx.activeLook?.outfit_id) meta.outfit_id = ctx.activeLook.outfit_id;
      if (ctx.activeLook?.garment_ids?.length) {
        meta.garment_ids = ctx.activeLook.garment_ids;
      } else if (ctx.anchorGarmentId) {
        meta.garment_ids = [ctx.anchorGarmentId];
      }
      return { signal_type: "quick_reaction", metadata: meta };
    },
    baseConfidence: 0.7,
    bindingRequired: "either",
  },
  {
    id: "never_suggest_en",
    locale: "en",
    trigger: /\bnever\s+(suggest|show me)\b/i,
    emit: (ctx) =>
      ctx.anchorGarmentId
        ? {
            signal_type: "never_suggest_garment",
            metadata: { garment_id: ctx.anchorGarmentId },
          }
        : null,
    baseConfidence: 0.8,
    bindingRequired: "anchor",
  },
  {
    id: "more_like_this_en",
    locale: "en",
    trigger: /\b(more like (this|that)|along these lines)\b/i,
    emit: (ctx) =>
      ctx.activeLook && ctx.activeLook.garment_ids.length >= 2
        ? {
            signal_type: "like_pair",
            metadata: { garment_ids: ctx.activeLook.garment_ids.slice(0, 2) },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "too_formal_en",
    locale: "en",
    trigger: /\btoo\s+(formal|fancy|dressy)\b/i,
    emit: (ctx) =>
      ctx.activeLook
        ? {
            signal_type: "quick_reaction",
            metadata: {
              value: "meh",
              formality_shift: -1,
              outfit_id: ctx.activeLook.outfit_id,
              garment_ids: ctx.activeLook.garment_ids,
            },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "too_casual_en",
    locale: "en",
    trigger: /\btoo\s+(casual|basic|plain)\b/i,
    emit: (ctx) =>
      ctx.activeLook
        ? {
            signal_type: "quick_reaction",
            metadata: {
              value: "meh",
              formality_shift: 1,
              outfit_id: ctx.activeLook.outfit_id,
              garment_ids: ctx.activeLook.garment_ids,
            },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "dislike_color_en",
    locale: "en",
    trigger: COLOR_REGEX_EN,
    emit: (ctx) => {
      const m = ctx.userTurn.match(COLOR_REGEX_EN);
      if (!m) return null;
      return {
        signal_type: "quick_reaction",
        metadata: { value: "dislike", color_avoid: m[1].toLowerCase() },
      };
    },
    baseConfidence: 0.65,
    bindingRequired: "none",
  },
  // ── SV ───────────────────────────────────────────────────────────
  {
    id: "hate_X_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}(hatar|avskyr)${SV_BA}`, "iu"),
    negation: new RegExp(`${SV_BB}(inte hatar|inte avskyr)${SV_BA}`, "iu"),
    emit: (ctx) => {
      const meta: Record<string, unknown> = { value: "dislike" };
      if (ctx.activeLook?.outfit_id) meta.outfit_id = ctx.activeLook.outfit_id;
      if (ctx.activeLook?.garment_ids?.length) {
        meta.garment_ids = ctx.activeLook.garment_ids;
      } else if (ctx.anchorGarmentId) {
        meta.garment_ids = [ctx.anchorGarmentId];
      }
      return { signal_type: "quick_reaction", metadata: meta };
    },
    baseConfidence: 0.7,
    bindingRequired: "either",
  },
  {
    id: "love_X_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}(älskar|gillar verkligen)${SV_BA}`, "iu"),
    negation: new RegExp(`${SV_BB}inte (älskar|gillar)${SV_BA}`, "iu"),
    emit: (ctx) => {
      const meta: Record<string, unknown> = { value: "love" };
      if (ctx.activeLook?.outfit_id) meta.outfit_id = ctx.activeLook.outfit_id;
      if (ctx.activeLook?.garment_ids?.length) {
        meta.garment_ids = ctx.activeLook.garment_ids;
      } else if (ctx.anchorGarmentId) {
        meta.garment_ids = [ctx.anchorGarmentId];
      }
      return { signal_type: "quick_reaction", metadata: meta };
    },
    baseConfidence: 0.7,
    bindingRequired: "either",
  },
  {
    id: "never_suggest_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}(visa aldrig|föreslå aldrig)${SV_BA}`, "iu"),
    emit: (ctx) =>
      ctx.anchorGarmentId
        ? {
            signal_type: "never_suggest_garment",
            metadata: { garment_id: ctx.anchorGarmentId },
          }
        : null,
    baseConfidence: 0.8,
    bindingRequired: "anchor",
  },
  {
    id: "more_like_this_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}mer\\s+(såna|sådana här)${SV_BA}`, "iu"),
    emit: (ctx) =>
      ctx.activeLook && ctx.activeLook.garment_ids.length >= 2
        ? {
            signal_type: "like_pair",
            metadata: { garment_ids: ctx.activeLook.garment_ids.slice(0, 2) },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "too_formal_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}för\\s+(formell|fin)${SV_BA}`, "iu"),
    emit: (ctx) =>
      ctx.activeLook
        ? {
            signal_type: "quick_reaction",
            metadata: {
              value: "meh",
              formality_shift: -1,
              outfit_id: ctx.activeLook.outfit_id,
              garment_ids: ctx.activeLook.garment_ids,
            },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "too_casual_sv",
    locale: "sv",
    trigger: new RegExp(`${SV_BB}för\\s+(vardaglig|enkel)${SV_BA}`, "iu"),
    emit: (ctx) =>
      ctx.activeLook
        ? {
            signal_type: "quick_reaction",
            metadata: {
              value: "meh",
              formality_shift: 1,
              outfit_id: ctx.activeLook.outfit_id,
              garment_ids: ctx.activeLook.garment_ids,
            },
          }
        : null,
    baseConfidence: 0.7,
    bindingRequired: "activeLook",
  },
  {
    id: "dislike_color_sv",
    locale: "sv",
    trigger: COLOR_REGEX_SV,
    emit: (ctx) => {
      const m = ctx.userTurn.match(COLOR_REGEX_SV);
      if (!m) return null;
      return {
        signal_type: "quick_reaction",
        metadata: { value: "dislike", color_avoid: m[1].toLowerCase() },
      };
    },
    baseConfidence: 0.65,
    bindingRequired: "none",
  },
];

function checkBinding(p: Pattern, ctx: ExtractionContext): boolean {
  switch (p.bindingRequired) {
    case "activeLook":
      return !!ctx.activeLook;
    case "anchor":
      return !!ctx.anchorGarmentId;
    case "either":
      return !!ctx.activeLook || !!ctx.anchorGarmentId;
    case "none":
      return true;
  }
}

function adjustConfidence(
  p: Pattern,
  ctx: ExtractionContext,
  negated: boolean,
): number {
  let c = p.baseConfidence;
  if (ctx.activeLook || ctx.anchorGarmentId) c += 0.1;
  const wordCount = ctx.userTurn.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 15) c += 0.1;
  if (negated) c -= 0.2;
  if (ctx.userTurn.includes("?")) c -= 0.3;
  return Math.max(0, Math.min(1, c));
}

/**
 * Extract structured memory events from a chat turn.
 *
 * @returns events with confidence ≥ CONFIDENCE_FLOOR. Below-threshold
 *   matches are silently dropped (callers can log them via the side
 *   channel if they want telemetry).
 */
export function extractMemoryEvents(
  ctx: ExtractionContext,
): ExtractedMemoryEvent[] {
  const events: ExtractedMemoryEvent[] = [];
  for (const p of PATTERNS) {
    if (p.locale !== ctx.locale) continue;
    if (!p.trigger.test(ctx.userTurn)) continue;
    const negated = p.negation?.test(ctx.userTurn) ?? false;
    // Negation completely vetoes the trigger when the pattern requires
    // binding (i.e., the user is making a claim ABOUT the active look).
    // Color-style patterns ('don't like the red one') intentionally use the
    // trigger regex's own structure to handle negation, so we don't apply
    // an additional veto.
    if (negated && p.bindingRequired !== "none") continue;
    if (!checkBinding(p, ctx)) continue;
    const emitted = p.emit(ctx);
    if (!emitted) continue;
    const confidence = adjustConfidence(p, ctx, negated);
    if (confidence < CONFIDENCE_FLOOR) continue;
    events.push({ ...emitted, confidence, pattern_id: p.id });
  }
  return events;
}
