// Deterministic style-summary builder.
//
// Built per Wave 8.5 P87 spec. Pure function: same inputs always produce the
// same `summary_json` + `summary_text`. No `Date.now()`, no `Math.random()`,
// no DB queries, no external API calls.
//
// Time anchor: the builder derives a deterministic "now" timestamp as the
// max `created_at` / `last_*_at` / `worn_at` it sees across the inputs. This
// keeps recency-decay reproducible even when the builder runs in different
// environments at different real wall-clock times.
//
// Decay: 90-day half-life — `weight = exp(-ln(2) * days_since / 90)`. Mirrors
// the pair-memory recency model at `outfit-scoring.ts:485-535` (which uses a
// linear ramp with a 0.3 floor — a simplified model that preserves the same
// 90-day "memory horizon"; the exponential here is closer to the spec's
// "explicit feedback > repeated behavior > single event" hierarchy).
//
// Confidence: Wilson-style smoothing — `confidence = (n_decayed) / (n_decayed + 3)`.
// Falls naturally between 0 and 1; saturates at 0.5 when N=3 (the spec's
// promotion threshold). Single events score 0.25 — present in summary but
// below the 0.3 hard-skip threshold called out in P88's spec.
//
// N=3 floor: only categories with `count >= 3` promote to `preferred_*` /
// `avoided_*`. Single negative events are recorded internally for
// future repeat-detection but never surface to the engines.
//
// Consumers:
//   - P85 `memory_ingest` edge function: invokes after each successful RPC
//     (fire-and-forget, debounced) to refresh `user_style_summaries`.
//   - P88 `burs_style_engine` + P89 `style_chat`: invoke on cache miss
//     (no row OR `dirty_at` non-null AND >24h old).
//
// IMPORTANT: this module is consumer-facing for both Deno (edge functions)
// AND Node/vitest (unit tests). It must therefore avoid Deno-only imports
// AND avoid ESM URL imports. Pure TypeScript, standard library only.

import {
  CANONICAL_STYLE_MEMORY_SIGNALS,
  type CanonicalStyleMemorySignal,
  normalizeStyleMemorySignal,
} from "./style-memory-signals.ts";
import { readUnifiedStylePrefs } from "./style-prefs-reader.ts";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Inputs to the deterministic builder. Caller (edge fn or test) is responsible
 * for SELECTing these rows from the relevant tables — the builder is pure.
 */
export interface StyleSummaryInputs {
  /** profiles row. Must include `preferences`. Optional body fields used in
   * confidence weighting only. */
  profile:
    | {
        preferences?: Record<string, unknown> | null;
        height_cm?: number | null;
        weight_kg?: number | null;
        home_city?: string | null;
      }
    | null;
  /** garments owned by the user — full rows with category / colors / fit /
   * pattern / wear_count / formality / etc. */
  garments: ReadonlyArray<GarmentLike>;
  /** outfits owned by the user — needs id + rating + feedback + saved + worn_at
   * + occasion + created_at. */
  outfits: ReadonlyArray<OutfitLike>;
  /** outfit_items rows joined to user's outfits (for cross-referencing
   * garment IDs back to outfits — colors / fits aggregate per-garment). */
  outfitItems: ReadonlyArray<OutfitItemLike>;
  /** wear_logs rows. Each row is treated as a synthetic `wear_outfit` event
   * per D2. */
  wearLogs: ReadonlyArray<WearLogLike>;
  /** feedback_signals rows — legacy `signal_type` values are normalized
   * through `normalizeStyleMemorySignal` before consumption. */
  feedbackSignals: ReadonlyArray<FeedbackSignalLike>;
  /** garment_pair_memory rows. */
  pairMemory: ReadonlyArray<PairMemoryLike>;
  /** planned_outfits rows. status='skipped' contributes a synthetic
   * `skip_outfit` event. status='worn' is covered by wear_logs. */
  plannedOutfits: ReadonlyArray<PlannedOutfitLike>;
  /** outfit_feedback rows — independent rating layer (1-5 + score sub-fields).
   * Feeds preferred_* / avoided_* via per-garment aggregation when score is
   * extreme (>=4 high or <=2 low). */
  outfitFeedback: ReadonlyArray<OutfitFeedbackLike>;
}

/** Output of the deterministic builder. Persisted to `user_style_summaries`. */
export interface StyleSummaryOutput {
  summary_json: StyleSummaryJson;
  /** ≤500 chars of English prose, safe to inject into AI prompts. */
  summary_text: string;
  /** Overall confidence 0-1, computed from total signal volume. */
  confidence: number;
  version: 1;
}

export interface StyleSummaryJson {
  preferred_colors: ConfidenceArray;
  avoided_colors: ConfidenceArray;
  preferred_fits: ConfidenceArray;
  avoided_fits: ConfidenceArray;
  preferred_categories: ConfidenceArray;
  underused_categories: ConfidenceArray;
  style_archetypes: ConfidenceArray;
  /** 0-100. Mean of formality scores from worn/saved garments, falls back
   * to profile.workFormality when wear data is sparse. */
  formality_center: number;
  favorite_pairings: PairingArray;
  avoided_pairings: PairingArray;
  avoid_rules: ReadonlyArray<{
    rule: string;
    confidence: number;
    source: "explicit" | "inferred";
  }>;
  weather_preferences: Readonly<
    Record<string, { value: string; confidence: number }>
  >;
  confidence_by_category: Readonly<Record<string, number>>;
  frequent_occasions: ConfidenceArray;
  /** Hard exclusion list — never_suggest_garment events. */
  never_suggest_garments: ReadonlyArray<string>;
}

export type ConfidenceArray = ReadonlyArray<{
  value: string;
  confidence: number;
}>;

export type PairingArray = ReadonlyArray<{
  a: string;
  b: string;
  weight: number;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// INPUT ROW SHAPES (loose, structural — no DB schema coupling)
// ─────────────────────────────────────────────────────────────────────────────

export interface GarmentLike {
  id: string;
  category?: string | null;
  subcategory?: string | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  pattern?: string | null;
  material?: string | null;
  fit?: string | null;
  formality?: number | null;
  season_tags?: ReadonlyArray<string> | null;
  wear_count?: number | null;
  last_worn_at?: string | null;
  style_archetype?: string | null;
  occasion_tags?: ReadonlyArray<string> | null;
  created_at?: string | null;
}

export interface OutfitLike {
  id: string;
  rating?: number | null;
  feedback?: ReadonlyArray<string> | null;
  saved?: boolean | null;
  worn_at?: string | null;
  occasion?: string | null;
  weather?: Record<string, unknown> | null;
  created_at?: string | null;
  generated_at?: string | null;
}

export interface OutfitItemLike {
  outfit_id: string;
  garment_id: string;
  slot?: string | null;
}

export interface WearLogLike {
  garment_id?: string | null;
  outfit_id?: string | null;
  worn_at?: string | null;
  occasion?: string | null;
  created_at?: string | null;
}

export interface FeedbackSignalLike {
  signal_type: string;
  outfit_id?: string | null;
  garment_id?: string | null;
  value?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

export interface PairMemoryLike {
  garment_a_id?: string | null;
  garment_b_id?: string | null;
  /** Legacy column names kept for compatibility with rows that pre-date the
   * P85 RPC's strict `garment_a_id`/`garment_b_id` columns. */
  garment_id_a?: string | null;
  garment_id_b?: string | null;
  positive_count?: number | null;
  negative_count?: number | null;
  last_positive_at?: string | null;
  last_negative_at?: string | null;
}

export interface PlannedOutfitLike {
  outfit_id?: string | null;
  date?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface OutfitFeedbackLike {
  outfit_id?: string | null;
  rating?: number | null;
  fit_score?: number | null;
  color_match_score?: number | null;
  overall_score?: number | null;
  created_at?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum N before a category promotes to preferred_* / avoided_*. P87 spec. */
const PROMOTION_FLOOR = 3;
/** 90-day decay half-life in days. Mirrors pair_memory model. */
const DECAY_HALF_LIFE_DAYS = 90;
/** Maximum size of the confidence-ranked output arrays. */
const MAX_PREFERRED = 5;
const MAX_AVOIDED = 5;
const MAX_FAVORITE_PAIRINGS = 10;
const MAX_AVOIDED_PAIRINGS = 5;
const MAX_OCCASIONS = 5;
const MAX_ARCHETYPES = 5;
const MAX_RULES = 8;
const MAX_SUMMARY_TEXT_CHARS = 500;
/** Wilson smoothing prior. confidence = n / (n + SMOOTHING_PRIOR). */
const SMOOTHING_PRIOR = 3;
/** Total-volume scale for overall confidence: capped at 1.0 when count = 50. */
const OVERALL_CONFIDENCE_SCALE = 50;
/** Fallback timestamp when the input set has no datable rows. ISO-8601 epoch +
 * a representative anchor. Choice is arbitrary but deterministic. */
const FALLBACK_TIME_ANCHOR_ISO = "2026-01-01T00:00:00.000Z";
/** "Limited signal" fallback prose. */
const LIMITED_SIGNAL_TEXT =
  "Limited signal yet — relying on style profile preferences.";
/** Confidence threshold below which the overall summary text falls back to
 * the limited-signal line. */
const LIMITED_SIGNAL_THRESHOLD = 0.2;
/** When clamping an avoid-rule confidence below this, drop it from
 * `avoid_rules` to keep the engines honest. */
const AVOID_RULE_DROP_THRESHOLD = 0.35;

/** Canonical signal categorization for pair-memory derivation + summary
 * derivation. Exposed read-only for tests. */
export const POSITIVE_SIGNALS: ReadonlyArray<CanonicalStyleMemorySignal> =
  Object.freeze([
    "save_outfit",
    "wear_outfit",
    "like_pair",
  ]);

export const NEGATIVE_SIGNALS: ReadonlyArray<CanonicalStyleMemorySignal> =
  Object.freeze([
    "reject_outfit",
    "skip_outfit",
    "dislike_pair",
    "never_suggest_garment",
  ]);

/** Words that, when found in feedback_text + matched against a real garment
 * attribute, escalate an avoid-rule's source from `inferred` to `explicit`. */
const EXPLICIT_AVOID_TOKENS = Object.freeze([
  "i hate",
  "i don't like",
  "never",
  "stop suggesting",
  "no more",
  "don't want",
] as const);

// Sentinel - asserts at compile time that POSITIVE/NEGATIVE arrays only contain
// values from the canonical signal union.
type _AssertCanonical = (typeof CANONICAL_STYLE_MEMORY_SIGNALS)[number];
const _exhaustivenessCheck: ReadonlyArray<_AssertCanonical> = [
  ...POSITIVE_SIGNALS,
  ...NEGATIVE_SIGNALS,
];
void _exhaustivenessCheck;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a deterministic style summary from the user's memory inputs.
 *
 * Pure function: same inputs always produce the same output. No `Date.now()`,
 * no `Math.random()`, no I/O.
 *
 * @param inputs - SELECTed rows from `profiles`, `garments`, `outfits`,
 *   `outfit_items`, `wear_logs`, `feedback_signals`, `garment_pair_memory`,
 *   `planned_outfits`, `outfit_feedback`. Caller (edge fn or test) is
 *   responsible for the queries.
 * @returns `{ summary_json, summary_text, confidence, version }`.
 */
export function buildStyleSummary(
  inputs: StyleSummaryInputs,
): StyleSummaryOutput {
  // Deterministic time anchor: max of all observable timestamps. If none,
  // use the fallback anchor.
  const nowMs = deriveTimeAnchor(inputs);

  // Index garments and outfits for fast lookup.
  const garmentById = new Map<string, GarmentLike>();
  for (const g of inputs.garments) garmentById.set(g.id, g);
  const outfitById = new Map<string, OutfitLike>();
  for (const o of inputs.outfits) outfitById.set(o.id, o);

  // Map outfit_id → garment_ids[] (ordered by insertion).
  const garmentsByOutfit = new Map<string, string[]>();
  for (const item of inputs.outfitItems) {
    if (!garmentsByOutfit.has(item.outfit_id)) {
      garmentsByOutfit.set(item.outfit_id, []);
    }
    garmentsByOutfit.get(item.outfit_id)!.push(item.garment_id);
  }

  // Synthesize all positive/negative events into a unified stream.
  const events = synthesizeEvents(inputs, garmentsByOutfit, nowMs);

  // Aggregate by feature with decay-weighted positive/negative tallies.
  const aggregations = aggregateFeatures(events, garmentById);

  // Hard-exclusion list (garment-level never_suggest_garment).
  const neverSuggestGarments = collectNeverSuggestGarments(
    inputs.feedbackSignals,
  );

  // Build the structured summary fields.
  const preferredColors = rankFeature(aggregations.colors, true);
  const avoidedColors = rankFeature(aggregations.colors, false);
  const preferredFits = rankFeature(aggregations.fits, true);
  const avoidedFits = rankFeature(aggregations.fits, false);
  const preferredCategories = rankFeature(aggregations.categories, true);
  const underusedCategories = computeUnderusedCategories(
    inputs.garments,
    aggregations.categories,
  );

  const styleArchetypes = computeStyleArchetypes(inputs, aggregations);
  const formalityCenter = computeFormalityCenter(inputs, garmentsByOutfit);
  const frequentOccasions = computeFrequentOccasions(inputs.outfits, nowMs);

  const favoritePairings = computeFavoritePairings(inputs.pairMemory, nowMs);
  const avoidedPairings = computeAvoidedPairings(inputs.pairMemory, nowMs);

  const avoidRules = computeAvoidRules(
    inputs.feedbackSignals,
    aggregations,
    garmentById,
  );

  const weatherPreferences = computeWeatherPreferences(inputs.outfits, nowMs);

  const confidenceByCategory = computeConfidenceByCategory(
    aggregations.categories,
    inputs.garments,
  );

  // Overall confidence = volume gauge.
  const totalEvents = events.length;
  const confidence = clamp(totalEvents / OVERALL_CONFIDENCE_SCALE, 0, 1);

  const summaryJson: StyleSummaryJson = {
    preferred_colors: preferredColors,
    avoided_colors: avoidedColors,
    preferred_fits: preferredFits,
    avoided_fits: avoidedFits,
    preferred_categories: preferredCategories,
    underused_categories: underusedCategories,
    style_archetypes: styleArchetypes,
    formality_center: formalityCenter,
    favorite_pairings: favoritePairings,
    avoided_pairings: avoidedPairings,
    avoid_rules: avoidRules,
    weather_preferences: weatherPreferences,
    confidence_by_category: confidenceByCategory,
    frequent_occasions: frequentOccasions,
    never_suggest_garments: neverSuggestGarments,
  };

  const summaryText = composeSummaryText(summaryJson, confidence);

  return Object.freeze({
    summary_json: summaryJson,
    summary_text: summaryText,
    confidence,
    version: 1 as const,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME ANCHOR
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the max timestamp seen across all input rows, in epoch ms.
 * Falls back to the anchor constant when the input set has no timestamps. */
function deriveTimeAnchor(inputs: StyleSummaryInputs): number {
  let maxMs = 0;
  const consider = (iso: string | null | undefined) => {
    if (!iso || typeof iso !== "string") return;
    const ms = Date.parse(iso);
    if (Number.isFinite(ms) && ms > maxMs) maxMs = ms;
  };
  for (const g of inputs.garments) {
    consider(g.created_at);
    consider(g.last_worn_at);
  }
  for (const o of inputs.outfits) {
    consider(o.created_at);
    consider(o.generated_at);
    consider(o.worn_at);
  }
  for (const w of inputs.wearLogs) {
    consider(w.worn_at);
    consider(w.created_at);
  }
  for (const f of inputs.feedbackSignals) consider(f.created_at);
  for (const p of inputs.pairMemory) {
    consider(p.last_positive_at);
    consider(p.last_negative_at);
  }
  for (const p of inputs.plannedOutfits) {
    consider(p.created_at);
    if (p.date) consider(`${p.date}T00:00:00.000Z`);
  }
  for (const f of inputs.outfitFeedback) consider(f.created_at);
  if (maxMs === 0) maxMs = Date.parse(FALLBACK_TIME_ANCHOR_ISO);
  return maxMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT SYNTHESIS
// ─────────────────────────────────────────────────────────────────────────────

/** Internal unified event stream — feedback_signals + wear_logs +
 * planned_outfits + outfit_feedback + outfit ratings/feedback all collapsed
 * into one shape so aggregation is uniform. */
interface SynthEvent {
  /** Canonical signal name. Always one of the 11 canonical names. */
  signal: CanonicalStyleMemorySignal;
  /** Decay-weight: exp(-ln(2) * days_since / 90). Range (0, 1]. */
  decayWeight: number;
  /** +1 positive, −1 negative, 0 neutral. */
  direction: 1 | -1 | 0;
  /** garment_ids the event touches (used for color/fit/category aggregation).
   * Empty for outfit-level signals with no items resolved. */
  garmentIds: ReadonlyArray<string>;
  /** Outfit id, when present. */
  outfitId: string | null;
  /** Optional value (e.g. quick_reaction direction). */
  value: string | null;
}

function synthesizeEvents(
  inputs: StyleSummaryInputs,
  garmentsByOutfit: Map<string, string[]>,
  nowMs: number,
): ReadonlyArray<SynthEvent> {
  const events: SynthEvent[] = [];

  // 1. feedback_signals — normalized through P83 helper.
  for (const sig of inputs.feedbackSignals) {
    const canonical = normalizeStyleMemorySignal(sig.signal_type);
    if (canonical === null) continue;
    const decay = decayWeight(nowMs, sig.created_at);
    if (decay <= 0) continue;
    const direction = directionForSignal(canonical, sig.value, sig.metadata);
    const garmentIds = resolveGarmentIdsForSignal(sig, garmentsByOutfit);
    events.push({
      signal: canonical,
      decayWeight: decay,
      direction,
      garmentIds,
      outfitId: sig.outfit_id ?? null,
      value: sig.value ?? null,
    });
  }

  // 2. wear_logs → synthetic wear_outfit (D2). Each row counted exactly once.
  for (const log of inputs.wearLogs) {
    const decay = decayWeight(nowMs, log.worn_at ?? log.created_at);
    if (decay <= 0) continue;
    const garmentIds: string[] = [];
    if (log.garment_id) garmentIds.push(log.garment_id);
    if (log.outfit_id && garmentsByOutfit.has(log.outfit_id)) {
      for (const id of garmentsByOutfit.get(log.outfit_id)!) {
        if (!garmentIds.includes(id)) garmentIds.push(id);
      }
    }
    events.push({
      signal: "wear_outfit",
      decayWeight: decay,
      direction: 1,
      garmentIds,
      outfitId: log.outfit_id ?? null,
      value: null,
    });
  }

  // 3. planned_outfits.status='skipped' → synthetic skip_outfit. status='worn'
  //    is covered by wear_logs (D2) so we skip it here to avoid double-counting.
  for (const planned of inputs.plannedOutfits) {
    if (planned.status !== "skipped") continue;
    const dateIso = planned.date
      ? `${planned.date}T00:00:00.000Z`
      : planned.created_at;
    const decay = decayWeight(nowMs, dateIso);
    if (decay <= 0) continue;
    const garmentIds = planned.outfit_id
      ? (garmentsByOutfit.get(planned.outfit_id) ?? [])
      : [];
    events.push({
      signal: "skip_outfit",
      decayWeight: decay,
      direction: -1,
      garmentIds,
      outfitId: planned.outfit_id ?? null,
      value: null,
    });
  }

  // 4. outfits.rating + feedback → synthetic rate_outfit events.
  for (const outfit of inputs.outfits) {
    if (typeof outfit.rating !== "number") continue;
    const decay = decayWeight(
      nowMs,
      outfit.generated_at ?? outfit.created_at,
    );
    if (decay <= 0) continue;
    const direction = outfit.rating >= 4 ? 1 : outfit.rating <= 2 ? -1 : 0;
    const garmentIds = garmentsByOutfit.get(outfit.id) ?? [];
    events.push({
      signal: "rate_outfit",
      decayWeight: decay,
      direction,
      garmentIds,
      outfitId: outfit.id,
      value: String(outfit.rating),
    });
  }

  // 5. outfit_feedback rows → independent rating layer; only extreme values
  //    contribute (>=4 or <=2) to avoid noise from middle scores.
  for (const fb of inputs.outfitFeedback) {
    if (typeof fb.rating !== "number") continue;
    if (fb.rating > 2 && fb.rating < 4) continue;
    const decay = decayWeight(nowMs, fb.created_at);
    if (decay <= 0) continue;
    const direction = fb.rating >= 4 ? 1 : -1;
    const garmentIds = fb.outfit_id
      ? (garmentsByOutfit.get(fb.outfit_id) ?? [])
      : [];
    events.push({
      signal: "rate_outfit",
      decayWeight: decay,
      direction,
      garmentIds,
      outfitId: fb.outfit_id ?? null,
      value: String(fb.rating),
    });
  }

  return events;
}

/** Resolve garment_ids for a feedback_signals row. If `garment_id` is set,
 * use it. If `outfit_id` is set, expand to that outfit's garments. */
function resolveGarmentIdsForSignal(
  sig: FeedbackSignalLike,
  garmentsByOutfit: Map<string, string[]>,
): ReadonlyArray<string> {
  const ids: string[] = [];
  // metadata.garment_ids takes precedence over scalar garment_id (newer API).
  const metaIds = sig.metadata?.["garment_ids"];
  if (Array.isArray(metaIds)) {
    for (const id of metaIds) {
      if (typeof id === "string" && !ids.includes(id)) ids.push(id);
    }
  }
  if (sig.garment_id && !ids.includes(sig.garment_id)) {
    ids.push(sig.garment_id);
  }
  if (sig.outfit_id && garmentsByOutfit.has(sig.outfit_id)) {
    for (const id of garmentsByOutfit.get(sig.outfit_id)!) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Determine direction (+1 / -1 / 0) for a canonical signal + optional value. */
function directionForSignal(
  signal: CanonicalStyleMemorySignal,
  value: string | null | undefined,
  metadata?: Record<string, unknown> | null,
): 1 | -1 | 0 {
  if ((POSITIVE_SIGNALS as ReadonlyArray<string>).includes(signal)) return 1;
  if ((NEGATIVE_SIGNALS as ReadonlyArray<string>).includes(signal)) return -1;
  if (signal === "rate_outfit") {
    const v = Number(value);
    if (Number.isFinite(v)) {
      if (v >= 4) return 1;
      if (v <= 2) return -1;
    }
    return 0;
  }
  if (signal === "swap_garment") {
    // The signal alone doesn't reveal direction; the swap RPC distributes the
    // weight in pair-memory directly. For feature aggregation we treat the
    // surviving (added) garments as positive and removed as negative — but
    // since we don't have removed-vs-added split here in the synth event,
    // we record as neutral. The aggregator handles the per-feature
    // distribution by reading metadata downstream if needed.
    return 0;
  }
  if (signal === "quick_reaction") {
    // Polarity may live in either `sig.value` (preferred) OR `metadata.value`
    // (legacy + ingest-helper writers). Mirrors the RPC contract at
    // `ingest_memory_event` lines 322-326 (`p_value` OR `p_metadata.value`).
    // Without the metadata fallback, summary aggregation under-counts
    // color/fit/category preferences for any quick_reaction whose polarity
    // was emitted via metadata only.
    const candidates: Array<string | null | undefined> = [value];
    if (metadata && typeof metadata === "object") {
      const metaValue = metadata["value"];
      if (typeof metaValue === "string") candidates.push(metaValue);
    }
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const v = candidate.toLowerCase();
      if (v === "like" || v === "positive" || v === "thumbs_up") return 1;
      if (v === "dislike" || v === "negative" || v === "thumbs_down") return -1;
    }
    return 0;
  }
  // unsave_outfit: neutral (cancels a prior save but we don't reverse).
  return 0;
}

/** Decay weight for the given timestamp.
 * - returns 1.0 when iso === nowMs (zero days since)
 * - returns 0.5 at 90 days
 * - returns ~0.063 at 360 days
 * - returns 1.0 when timestamp is missing/invalid (treated as "fresh") */
function decayWeight(nowMs: number, iso: string | null | undefined): number {
  if (!iso || typeof iso !== "string") return 1.0;
  const eventMs = Date.parse(iso);
  if (!Number.isFinite(eventMs)) return 1.0;
  const daysSince = Math.max(0, (nowMs - eventMs) / (24 * 60 * 60 * 1000));
  return Math.exp(-Math.LN2 * daysSince / DECAY_HALF_LIFE_DAYS);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureAggregations {
  colors: FeatureMap;
  fits: FeatureMap;
  categories: FeatureMap;
  archetypes: FeatureMap;
}

/** Per-value aggregated +/- decayed counts. */
interface FeatureCounts {
  positive: number;
  negative: number;
  raw: number; // total events touching this feature, no decay (for N-floor)
}

/** Map keyed by lowercased value → counts. */
type FeatureMap = Map<string, FeatureCounts>;

function aggregateFeatures(
  events: ReadonlyArray<SynthEvent>,
  garmentById: Map<string, GarmentLike>,
): FeatureAggregations {
  const colors: FeatureMap = new Map();
  const fits: FeatureMap = new Map();
  const categories: FeatureMap = new Map();
  const archetypes: FeatureMap = new Map();

  for (const ev of events) {
    if (ev.direction === 0) continue; // neutral events don't shift preference
    for (const id of ev.garmentIds) {
      const g = garmentById.get(id);
      if (!g) continue;
      const w = ev.decayWeight * Math.abs(ev.direction);
      const positive = ev.direction > 0;
      contribute(colors, normalizeColor(g.color_primary), w, positive);
      contribute(colors, normalizeColor(g.color_secondary), w, positive);
      contribute(fits, normalizeFit(g.fit), w, positive);
      contribute(categories, normalizeCategory(g.category), w, positive);
      contribute(archetypes, normalizeArchetype(g.style_archetype), w, positive);
    }
  }

  return { colors, fits, categories, archetypes };
}

function contribute(
  map: FeatureMap,
  value: string | null,
  weight: number,
  positive: boolean,
): void {
  if (value === null || value.length === 0) return;
  let entry = map.get(value);
  if (!entry) {
    entry = { positive: 0, negative: 0, raw: 0 };
    map.set(value, entry);
  }
  if (positive) entry.positive += weight;
  else entry.negative += weight;
  entry.raw += 1;
}

function normalizeColor(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

function normalizeFit(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  return value.trim().toLowerCase();
}

function normalizeArchetype(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCategory(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  // Category alias map matches canonicalCategory in _shared/retrieval.ts:
  // tops→top, bottoms→bottom, shoe→shoes, accessories→accessory.
  const lower = value.trim().toLowerCase();
  switch (lower) {
    case "tops":
      return "top";
    case "bottoms":
      return "bottom";
    case "shoe":
      return "shoes";
    case "accessories":
      return "accessory";
    case "outerwears":
      return "outerwear";
    case "dresses":
      return "dress";
    default:
      return lower;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE RANKING (preferred / avoided)
// ─────────────────────────────────────────────────────────────────────────────

/** Compute ranked array of preferred or avoided values for one feature.
 * Applies the N=3 floor and Wilson smoothing. */
function rankFeature(
  map: FeatureMap,
  preferred: boolean,
): ConfidenceArray {
  const items: Array<{ value: string; confidence: number; net: number }> = [];
  for (const [value, counts] of map.entries()) {
    if (counts.raw < PROMOTION_FLOOR) continue;
    const net = preferred
      ? counts.positive - counts.negative
      : counts.negative - counts.positive;
    if (net <= 0) continue;
    const confidence = net / (net + SMOOTHING_PRIOR);
    items.push({ value, confidence, net });
  }
  items.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.net !== a.net) return b.net - a.net;
    return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  });
  const max = preferred ? MAX_PREFERRED : MAX_AVOIDED;
  return Object.freeze(
    items.slice(0, max).map((i) =>
      Object.freeze({
        value: i.value,
        confidence: round3(i.confidence),
      })
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES — UNDERUSED
// ─────────────────────────────────────────────────────────────────────────────

function computeUnderusedCategories(
  garments: ReadonlyArray<GarmentLike>,
  categories: FeatureMap,
): ConfidenceArray {
  // Tally garments-per-category from the wardrobe (independent of events).
  const counts = new Map<string, number>();
  for (const g of garments) {
    const cat = normalizeCategory(g.category);
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  if (counts.size === 0) return Object.freeze([]);

  // "Underused" = categories present in wardrobe but with low or zero
  // positive engagement. Confidence reflects how confident we are this is
  // genuinely underused: high when the wardrobe has many items in this
  // category but few positive events touch them.
  const items: Array<{ value: string; confidence: number; ratio: number }> = [];
  for (const [cat, wardrobeCount] of counts.entries()) {
    if (wardrobeCount < 2) continue; // 1-item categories aren't underused, just sparse
    const eventCounts = categories.get(cat);
    const positiveEvents = eventCounts?.positive ?? 0;
    const ratio = positiveEvents / wardrobeCount;
    if (ratio >= 0.5) continue; // healthy engagement
    // Confidence: higher when ratio is lower AND wardrobe count is larger.
    const confidence = (1 - Math.min(1, ratio)) * (1 - 1 / (wardrobeCount + 1));
    items.push({ value: cat, confidence, ratio });
  }
  items.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.value < b.value ? -1 : 1;
  });
  return Object.freeze(
    items.slice(0, MAX_PREFERRED).map((i) =>
      Object.freeze({
        value: i.value,
        confidence: round3(i.confidence),
      })
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE ARCHETYPES
// ─────────────────────────────────────────────────────────────────────────────

function computeStyleArchetypes(
  inputs: StyleSummaryInputs,
  aggregations: FeatureAggregations,
): ConfidenceArray {
  const items = new Map<string, { confidence: number; explicit: boolean }>();

  // 1. Explicit styleProfile.styleWords from preferences.
  const sp = getStyleProfile(inputs.profile);
  const styleWords = asStringArray(sp?.["styleWords"]);
  for (const word of styleWords) {
    const v = String(word).trim().toLowerCase();
    if (!v) continue;
    items.set(v, { confidence: 0.85, explicit: true });
  }

  // 2. Repeated behavior from `garment.style_archetype`, weighted by
  // POSITIVE/NEGATIVE event evidence — NOT by inventory size.
  //
  // Earlier revisions of this builder counted archetypes purely from the
  // user's owned garments (inventory size), which let archetypes get
  // promoted to the persisted summary even when interaction signals were
  // neutral or actively negative. Because `style_archetypes` feeds the
  // engine readers, that biased recommendations toward whatever the user
  // happened to own rather than what they actually engaged with. The
  // archetype map populated by `aggregateFeatures` carries decayed
  // positive/negative counts per archetype, so we now apply the same
  // PROMOTION_FLOOR + Wilson smoothing rule used for colors / fits /
  // categories — net positive evidence required, raw event count must
  // clear the floor, otherwise the archetype is dropped.
  for (const [v, counts] of aggregations.archetypes.entries()) {
    if (counts.raw < PROMOTION_FLOOR) continue;
    if (items.has(v)) continue; // explicit profile entry already added
    const net = counts.positive - counts.negative;
    if (net <= 0) continue;
    // Wilson-smoothed confidence, capped well below the explicit-profile
    // ceiling (0.85) so direct user statements still rank first.
    const confidence = clamp(net / (net + SMOOTHING_PRIOR), 0, 0.7);
    items.set(v, { confidence, explicit: false });
  }

  const sorted = Array.from(items.entries())
    .map(([value, { confidence, explicit }]) => ({
      value,
      confidence,
      explicit,
    }))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (a.explicit !== b.explicit) return a.explicit ? -1 : 1;
      return a.value < b.value ? -1 : 1;
    });

  return Object.freeze(
    sorted.slice(0, MAX_ARCHETYPES).map((i) =>
      Object.freeze({
        value: i.value,
        confidence: round3(i.confidence),
      })
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMALITY CENTER
// ─────────────────────────────────────────────────────────────────────────────

function computeFormalityCenter(
  inputs: StyleSummaryInputs,
  garmentsByOutfit: Map<string, string[]>,
): number {
  // Mean of formality scores from worn / saved garments.
  // garments.formality is 1-5 (DB default 3); we convert to 0-100.
  const formalitySamples: number[] = [];
  // Use wear_logs (D2 source of truth) plus saved outfits.
  const garmentById = new Map<string, GarmentLike>();
  for (const g of inputs.garments) garmentById.set(g.id, g);

  for (const log of inputs.wearLogs) {
    if (log.garment_id) {
      const g = garmentById.get(log.garment_id);
      if (g && typeof g.formality === "number") {
        formalitySamples.push(g.formality);
      }
    }
    if (log.outfit_id) {
      const ids = garmentsByOutfit.get(log.outfit_id) ?? [];
      for (const id of ids) {
        const g = garmentById.get(id);
        if (g && typeof g.formality === "number") {
          formalitySamples.push(g.formality);
        }
      }
    }
  }
  for (const o of inputs.outfits) {
    if (!o.saved) continue;
    const ids = garmentsByOutfit.get(o.id) ?? [];
    for (const id of ids) {
      const g = garmentById.get(id);
      if (g && typeof g.formality === "number") {
        formalitySamples.push(g.formality);
      }
    }
  }

  if (formalitySamples.length >= 3) {
    const mean = formalitySamples.reduce((a, b) => a + b, 0) /
      formalitySamples.length;
    // formality 1-5 → 0-100.
    return Math.round(((mean - 1) / 4) * 100);
  }

  // Fallback: profile.workFormality if available (StyleProfileV3 0-100 scale).
  const sp = getStyleProfile(inputs.profile);
  const workF = sp?.["workFormality"];
  if (typeof workF === "number" && workF >= 0 && workF <= 100) {
    return Math.round(workF);
  }
  // Default neutral.
  return 50;
}

// ─────────────────────────────────────────────────────────────────────────────
// FREQUENT OCCASIONS
// ─────────────────────────────────────────────────────────────────────────────

function computeFrequentOccasions(
  outfits: ReadonlyArray<OutfitLike>,
  nowMs: number,
): ConfidenceArray {
  const map: FeatureMap = new Map();
  for (const o of outfits) {
    if (!o.occasion) continue;
    const v = String(o.occasion).trim().toLowerCase();
    if (!v) continue;
    const positive = !!o.saved || (typeof o.rating === "number" && o.rating >= 3) ||
      !!o.worn_at;
    const decay = decayWeight(nowMs, o.worn_at ?? o.generated_at ?? o.created_at);
    if (decay <= 0) continue;
    contribute(map, v, decay, positive);
  }
  // Rank as "preferred" (positive net).
  const items: Array<{ value: string; confidence: number; net: number }> = [];
  for (const [value, counts] of map.entries()) {
    if (counts.raw < PROMOTION_FLOOR) continue;
    const net = counts.positive - counts.negative;
    if (net <= 0) continue;
    const confidence = net / (net + SMOOTHING_PRIOR);
    items.push({ value, confidence, net });
  }
  items.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.net !== a.net) return b.net - a.net;
    return a.value < b.value ? -1 : 1;
  });
  return Object.freeze(
    items.slice(0, MAX_OCCASIONS).map((i) =>
      Object.freeze({
        value: i.value,
        confidence: round3(i.confidence),
      })
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAIRINGS
// ─────────────────────────────────────────────────────────────────────────────

function computeFavoritePairings(
  rows: ReadonlyArray<PairMemoryLike>,
  nowMs: number,
): PairingArray {
  const items: Array<{ a: string; b: string; weight: number }> = [];
  for (const row of rows) {
    const a = pairA(row);
    const b = pairB(row);
    if (!a || !b) continue;
    const pos = row.positive_count ?? 0;
    const neg = row.negative_count ?? 0;
    if (pos < 2) continue;
    if (neg >= pos) continue;
    const decay = decayWeight(nowMs, row.last_positive_at);
    const weight = (pos - neg) * decay;
    if (weight <= 0) continue;
    items.push({ a, b, weight: round3(weight) });
  }
  items.sort((x, y) => {
    if (y.weight !== x.weight) return y.weight - x.weight;
    if (x.a !== y.a) return x.a < y.a ? -1 : 1;
    return x.b < y.b ? -1 : 1;
  });
  return Object.freeze(
    items.slice(0, MAX_FAVORITE_PAIRINGS).map((i) => Object.freeze(i)),
  );
}

function computeAvoidedPairings(
  rows: ReadonlyArray<PairMemoryLike>,
  nowMs: number,
): PairingArray {
  const items: Array<{ a: string; b: string; weight: number }> = [];
  for (const row of rows) {
    const a = pairA(row);
    const b = pairB(row);
    if (!a || !b) continue;
    const pos = row.positive_count ?? 0;
    const neg = row.negative_count ?? 0;
    if (neg < 2) continue;
    if (pos >= neg) continue;
    const decay = decayWeight(nowMs, row.last_negative_at);
    const weight = (neg - pos) * decay;
    if (weight <= 0) continue;
    items.push({ a, b, weight: round3(weight) });
  }
  items.sort((x, y) => {
    if (y.weight !== x.weight) return y.weight - x.weight;
    if (x.a !== y.a) return x.a < y.a ? -1 : 1;
    return x.b < y.b ? -1 : 1;
  });
  return Object.freeze(
    items.slice(0, MAX_AVOIDED_PAIRINGS).map((i) => Object.freeze(i)),
  );
}

function pairA(row: PairMemoryLike): string | null {
  return row.garment_a_id ?? row.garment_id_a ?? null;
}
function pairB(row: PairMemoryLike): string | null {
  return row.garment_b_id ?? row.garment_id_b ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AVOID RULES
// ─────────────────────────────────────────────────────────────────────────────

function computeAvoidRules(
  feedbackSignals: ReadonlyArray<FeedbackSignalLike>,
  aggregations: FeatureAggregations,
  garmentById: Map<string, GarmentLike>,
): StyleSummaryJson["avoid_rules"] {
  const rules: Array<{
    rule: string;
    confidence: number;
    source: "explicit" | "inferred";
  }> = [];

  // 1. Explicit text rules from feedback_text.
  for (const sig of feedbackSignals) {
    const meta = sig.metadata ?? {};
    const text = String(meta["feedback_text"] ?? "").toLowerCase();
    if (!text) continue;
    const hasExplicit = EXPLICIT_AVOID_TOKENS.some((t) => text.includes(t));
    if (!hasExplicit) continue;
    // Find a referenced fit/category/color in the same text.
    const referencedFit = findReferenced(text, aggregations.fits);
    const referencedColor = findReferenced(text, aggregations.colors);
    const referencedCategory = findReferenced(text, aggregations.categories);
    const refs = [
      referencedFit ? `${referencedFit} fits` : null,
      referencedColor ? `color ${referencedColor}` : null,
      referencedCategory ? `category ${referencedCategory}` : null,
    ].filter((x): x is string => x !== null);
    for (const ref of refs) {
      rules.push({ rule: `avoid ${ref}`, confidence: 0.9, source: "explicit" });
    }
  }

  // 2. Inferred fit rules from repeated avoidance.
  for (const [fit, counts] of aggregations.fits.entries()) {
    if (counts.raw < PROMOTION_FLOOR) continue;
    const net = counts.negative - counts.positive;
    if (net <= 0) continue;
    const confidence = net / (net + SMOOTHING_PRIOR);
    if (confidence < AVOID_RULE_DROP_THRESHOLD) continue;
    rules.push({
      rule: `avoid ${fit} fits`,
      confidence: round3(confidence),
      source: "inferred",
    });
  }

  // 3. Inferred color rules — only if very strong signal (5+ negatives net).
  for (const [color, counts] of aggregations.colors.entries()) {
    const net = counts.negative - counts.positive;
    if (net < 5) continue;
    const confidence = net / (net + SMOOTHING_PRIOR);
    if (confidence < AVOID_RULE_DROP_THRESHOLD) continue;
    rules.push({
      rule: `avoid color ${color}`,
      confidence: round3(confidence),
      source: "inferred",
    });
  }

  // 4. never_suggest_garment events become avoid_rules referencing the
  //    garment's title/category if known. Per-garment hard exclusion lives
  //    in the never_suggest_garments hard list — these rules are a
  //    human-readable annotation.
  const seenGarmentIds = new Set<string>();
  for (const sig of feedbackSignals) {
    const canonical = normalizeStyleMemorySignal(sig.signal_type);
    if (canonical !== "never_suggest_garment") continue;
    if (!sig.garment_id || seenGarmentIds.has(sig.garment_id)) continue;
    seenGarmentIds.add(sig.garment_id);
    const g = garmentById.get(sig.garment_id);
    if (!g) continue;
    const cat = normalizeCategory(g.category);
    if (!cat) continue;
    rules.push({
      rule: `never suggest specific ${cat} (${sig.garment_id.slice(0, 8)})`,
      confidence: 1.0,
      source: "explicit",
    });
  }

  // Dedup + sort + cap.
  const dedup = new Map<string, typeof rules[number]>();
  for (const r of rules) {
    const existing = dedup.get(r.rule);
    if (!existing || r.confidence > existing.confidence) {
      dedup.set(r.rule, r);
    }
  }
  const out = Array.from(dedup.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.rule < b.rule ? -1 : 1;
  });
  return Object.freeze(out.slice(0, MAX_RULES).map((r) => Object.freeze(r)));
}

function findReferenced(text: string, map: FeatureMap): string | null {
  // Only return references to features already in the aggregation map (and
  // present with N>=1 events). Picks the longest match for specificity.
  let best: string | null = null;
  for (const value of map.keys()) {
    if (value.length < 3) continue;
    if (text.includes(value)) {
      if (!best || value.length > best.length) best = value;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEATHER PREFERENCES
// ─────────────────────────────────────────────────────────────────────────────

function computeWeatherPreferences(
  outfits: ReadonlyArray<OutfitLike>,
  nowMs: number,
): Readonly<Record<string, { value: string; confidence: number }>> {
  // outfits.weather is a JSONB blob — best-effort extraction. We aggregate
  // the dominant temperature band ("cold" | "mild" | "warm") for saved /
  // worn outfits.
  const bands = new Map<string, FeatureCounts>();
  for (const o of outfits) {
    if (!o.weather || typeof o.weather !== "object") continue;
    const weather = o.weather as Record<string, unknown>;
    const temp = Number(
      weather["temp_c"] ?? weather["temperature"] ?? weather["temp"],
    );
    if (!Number.isFinite(temp)) continue;
    const band = temp < 10 ? "cold" : temp < 22 ? "mild" : "warm";
    const positive = !!o.saved || (typeof o.rating === "number" && o.rating >= 3) ||
      !!o.worn_at;
    if (!positive) continue;
    const decay = decayWeight(nowMs, o.worn_at ?? o.generated_at ?? o.created_at);
    if (decay <= 0) continue;
    contribute(bands, band, decay, true);
  }

  const out: Record<string, { value: string; confidence: number }> = {};
  for (const [band, counts] of bands.entries()) {
    if (counts.raw < PROMOTION_FLOOR) continue;
    const confidence = counts.positive / (counts.positive + SMOOTHING_PRIOR);
    out[band] = Object.freeze({
      // The "value" is just an activity hint — the band itself is the key.
      value: `prefers ${band} layering`,
      confidence: round3(confidence),
    });
  }
  return Object.freeze(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE BY CATEGORY
// ─────────────────────────────────────────────────────────────────────────────

function computeConfidenceByCategory(
  categories: FeatureMap,
  garments: ReadonlyArray<GarmentLike>,
): Readonly<Record<string, number>> {
  const wardrobeByCat = new Map<string, number>();
  for (const g of garments) {
    const cat = normalizeCategory(g.category);
    if (!cat) continue;
    wardrobeByCat.set(cat, (wardrobeByCat.get(cat) ?? 0) + 1);
  }
  const out: Record<string, number> = {};
  for (const [cat, _wardrobeCount] of wardrobeByCat.entries()) {
    const events = categories.get(cat);
    const positive = events?.positive ?? 0;
    const negative = events?.negative ?? 0;
    const total = positive + negative;
    // Confidence rises with total event volume, saturating at ~1.0 around
    // 10 events. Below 3 events the confidence is "low".
    const confidence = total < 1 ? 0 : total / (total + 3);
    out[cat] = round3(confidence);
  }
  return Object.freeze(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// NEVER SUGGEST GARMENTS
// ─────────────────────────────────────────────────────────────────────────────

function collectNeverSuggestGarments(
  feedbackSignals: ReadonlyArray<FeedbackSignalLike>,
): ReadonlyArray<string> {
  const seen = new Set<string>();
  for (const sig of feedbackSignals) {
    const canonical = normalizeStyleMemorySignal(sig.signal_type);
    if (canonical !== "never_suggest_garment") continue;
    if (!sig.garment_id) continue;
    seen.add(sig.garment_id);
  }
  return Object.freeze(Array.from(seen).sort());
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY TEXT COMPOSITION
// ─────────────────────────────────────────────────────────────────────────────

/** Compose the ≤500-char summary_text from the structured summary_json.
 * Prose order is fixed for determinism. */
function composeSummaryText(
  summary: StyleSummaryJson,
  overallConfidence: number,
): string {
  if (overallConfidence < LIMITED_SIGNAL_THRESHOLD) {
    return LIMITED_SIGNAL_TEXT;
  }

  const parts: string[] = [];

  // Sentence 1: archetypes + formality + colors.
  const archetypes = summary.style_archetypes
    .slice(0, 3)
    .map((a) => a.value)
    .filter(Boolean);
  const colorsPref = summary.preferred_colors.slice(0, 3).map((c) => c.value);
  const formalityWord = formalityWordFor(summary.formality_center);
  const lifestyleSegment = archetypes.length > 0
    ? `${archetypes.join(" / ")} ${formalityWord}`
    : formalityWord;
  const colorClause = colorsPref.length > 0
    ? ` in ${colorsPref.join(", ")}`
    : "";
  parts.push(
    capitalize(`User prefers ${lifestyleSegment} outfits${colorClause}.`),
  );

  // Sentence 2: avoidance.
  const avoidPieces: string[] = [];
  const avoidedFits = summary.avoided_fits.slice(0, 2).map((f) => f.value);
  if (avoidedFits.length > 0) avoidPieces.push(`${avoidedFits.join(" and ")} fits`);
  const avoidedColors = summary.avoided_colors.slice(0, 2).map((c) => c.value);
  if (avoidedColors.length > 0) avoidPieces.push(`${avoidedColors.join(" and ")} colors`);
  // explicit rules can supplement when their wording adds info.
  for (const r of summary.avoid_rules) {
    if (avoidPieces.length >= 3) break;
    if (r.source !== "explicit") continue;
    if (avoidPieces.some((p) => r.rule.includes(p))) continue;
    avoidPieces.push(r.rule.replace(/^avoid\s+/, ""));
  }
  if (avoidPieces.length > 0) {
    parts.push(`They avoid ${avoidPieces.join(" and ")}.`);
  }

  // Sentence 3: occasions.
  const occasions = summary.frequent_occasions.slice(0, 2).map((o) => o.value);
  if (occasions.length > 0) {
    parts.push(`Frequent occasions: ${occasions.join(", ")}.`);
  }

  // Sentence 4: weather hint.
  const coldHint = summary.weather_preferences["cold"];
  const warmHint = summary.weather_preferences["warm"];
  if (coldHint && warmHint) {
    parts.push("Layering preferences vary across cold and warm conditions.");
  } else if (coldHint) {
    parts.push("Outerwear preferred under cold conditions.");
  } else if (warmHint) {
    parts.push("Lighter layering preferred under warm conditions.");
  }

  // Sentence 5: never-suggest count (if any).
  if (summary.never_suggest_garments.length > 0) {
    parts.push(
      `${summary.never_suggest_garments.length} garment(s) marked never-suggest.`,
    );
  }

  let out = parts.join(" ");
  if (out.length > MAX_SUMMARY_TEXT_CHARS) {
    out = out.slice(0, MAX_SUMMARY_TEXT_CHARS - 3).trimEnd() + "...";
  }
  return out;
}

function formalityWordFor(score: number): string {
  if (score >= 70) return "formal";
  if (score >= 55) return "smart-casual";
  if (score >= 35) return "casual";
  return "relaxed";
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getStyleProfile(
  profile: StyleSummaryInputs["profile"],
): Record<string, unknown> | null {
  if (!profile?.preferences) return null;
  // Theme 7 (post-launch audit): unified V3-vocab view that falls back to
  // V4 canonical fields (`archetypes`, `formalityFloor` / `formalityCeiling`,
  // `fitOverall`, …) for slots the V3 mirror leaves empty / missing. Closes
  // the formality_center=50-for-every-pre-M25-user gap caused by the V3
  // mirror writing `workFormality: ''` (skip-semantics that this builder
  // used to interpret as "fall back to neutral 50") and the V4-native cold-
  // start race window where the V3 mirror is missing entirely. See
  // `_shared/style-prefs-reader.ts` for the full rationale.
  // Always returns at least `{}` so existing callers' `sp?.["…"]` reads
  // null-coalesce identically to the pre-refactor `return prefs` path.
  return readUnifiedStylePrefs(profile.preferences);
}

function asStringArray(v: unknown): ReadonlyArray<string> {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
