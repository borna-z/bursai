// Canonical Style Memory signal taxonomy + legacy normalization helper.
//
// Built per Wave 8.5 P83 spec. The legacy → canonical map below is derived
// from `docs/launch/wave-8.5-p82-audit.md` §7a (writer + reader names found
// across the codebase pre-Wave-8.5) and Resolved decision D1 (reject
// disambiguation).
//
// Subsequent prompts consume this module:
//   - P85 `memory_ingest` edge function: validates incoming `event_type`
//     via `normalizeStyleMemorySignal` before writing; logs warning + drops
//     event if return is null.
//   - P86 wire-up: `useFeedbackSignals` is rewritten to call `memory_ingest`
//     so the canonical names enter the system at the boundary.
//   - P87 deterministic summary builder: reads `feedback_signals` rows
//     through the helper to merge legacy + canonical histories.
//   - P88 `burs_style_engine` + P89 `style_chat`: reads do the same.
//
// This module is pure (no Deno imports, no runtime deps) so it bundles
// safely into every edge function consumer AND runs unmodified under
// vitest for unit tests.

/**
 * The 11 canonical Style Memory signal names.
 *
 * All future writers MUST emit one of these. Readers MUST match against
 * one of these (after passing legacy values through `normalizeStyleMemorySignal`).
 *
 * Naming convention: `{verb}_{target}` where target ∈ {outfit, garment, pair}.
 *
 * Semantic distinctions (driven by Resolved decision D1):
 *   - `reject_outfit` is OUTFIT-LEVEL — penalize the combination, leave
 *     individual garments viable for other contexts.
 *   - `never_suggest_garment` is GARMENT-LEVEL — hard exclusion from
 *     all candidate pools.
 */
export type CanonicalStyleMemorySignal =
  | "save_outfit" // user saved an outfit (toggle on)
  | "unsave_outfit" // user removed save (toggle off)
  | "rate_outfit" // user rated outfit 1-5 stars (rating in metadata)
  | "wear_outfit" // user marked outfit as worn (incl. planned follow-through)
  | "skip_outfit" // user skipped a planned/suggested outfit
  | "reject_outfit" // user rejected the COMBINATION (outfit-level penalty)
  | "swap_garment" // user swapped one garment for another in an outfit
  | "quick_reaction" // ad-hoc thumb / emoji reaction (value in metadata)
  | "never_suggest_garment" // hard exclusion: never show this garment in suggestions
  | "like_pair" // explicit positive on a garment pair
  | "dislike_pair"; // explicit negative on a garment pair

/**
 * Tuple form of `CanonicalStyleMemorySignal` — useful for runtime iteration
 * (e.g., test fixtures, future DB CHECK constraints, schema validation).
 *
 * Order matches the type union for readability.
 */
export const CANONICAL_STYLE_MEMORY_SIGNALS = [
  "save_outfit",
  "unsave_outfit",
  "rate_outfit",
  "wear_outfit",
  "skip_outfit",
  "reject_outfit",
  "swap_garment",
  "quick_reaction",
  "never_suggest_garment",
  "like_pair",
  "dislike_pair",
] as const satisfies readonly CanonicalStyleMemorySignal[];

/**
 * Type guard — does this value match a canonical signal name?
 *
 * Case-sensitive. Returns false for legacy names (e.g., `'save'`) and
 * unknown strings.
 */
export function isCanonicalStyleMemorySignal(
  value: unknown,
): value is CanonicalStyleMemorySignal {
  return (
    typeof value === "string" &&
    (CANONICAL_STYLE_MEMORY_SIGNALS as readonly string[]).includes(value)
  );
}

/**
 * Legacy → canonical map.
 *
 * Source of truth: `docs/launch/wave-8.5-p82-audit.md` §7a.
 *
 * Notes on lossy mappings:
 *   - `dislike` / `thumbs_down` / `like` collapse to `quick_reaction`.
 *     The original names carried direction info that can't be recovered
 *     from the canonical name alone. Callers MUST enrich `metadata.value`
 *     at the write site (P85 `memory_ingest` is the validation gate).
 *   - `garment_edit` maps to `null` — never emitted in production code,
 *     confirmed by the P82 audit. Callers should drop the event with a
 *     logged warning.
 *
 * The map is keyed by exact-match string; case-sensitive. Object lookup
 * with a missing key returns `undefined`, which `normalizeStyleMemorySignal`
 * coerces to `null`.
 */
const LEGACY_TO_CANONICAL: Readonly<
  Record<string, CanonicalStyleMemorySignal | null>
> = Object.freeze({
  // Canonical passthrough — explicit so unknown-value detection is unambiguous.
  save_outfit: "save_outfit",
  unsave_outfit: "unsave_outfit",
  rate_outfit: "rate_outfit",
  wear_outfit: "wear_outfit",
  skip_outfit: "skip_outfit",
  reject_outfit: "reject_outfit",
  swap_garment: "swap_garment",
  quick_reaction: "quick_reaction",
  never_suggest_garment: "never_suggest_garment",
  like_pair: "like_pair",
  dislike_pair: "dislike_pair",

  // Outfit-save legacy (currently emitted by `useFeedbackSignals` +
  // `OutfitDetail.tsx:216`). `saved` is a defensive alias not currently
  // emitted but listed in P82 spec.
  save: "save_outfit",
  saved: "save_outfit",
  unsave: "unsave_outfit",

  // Rating legacy (currently emitted by `OutfitDetail.tsx:229`).
  rating: "rate_outfit",

  // Wear legacy:
  //   - `wear_confirm` is currently emitted by `OutfitDetail.tsx:260`.
  //   - `wear` is the latent dead read at `style_chat/index.ts:1206`
  //     (filtered out before reaching the count, but the name is
  //     reserved by the read site and might appear in any historical
  //     row migrated from a peer system).
  //   - `planned_follow_through` is a dead enum (never emitted in
  //     production code) but reserved in P82 spec for future calendar
  //     follow-through wiring.
  wear_confirm: "wear_outfit",
  wear: "wear_outfit",
  planned_follow_through: "wear_outfit",

  // Swap legacy:
  //   - `swap_choice` is currently emitted by `OutfitDetail.tsx:197`.
  //   - `swap` is the read-side name in `burs_style_engine:995`
  //     and `style_chat/wardrobe-context.ts:190`.
  swap_choice: "swap_garment",
  swap: "swap_garment",

  // Skip legacy:
  //   - `ignore` is the read-side name in `burs_style_engine:1004`.
  //   - `planned_skip` is the dead enum reserved for future calendar
  //     skip wiring (P86 will wire it on Plan calendar).
  ignore: "skip_outfit",
  planned_skip: "skip_outfit",

  // Reject legacy. D1 resolution: outfit-level intent.
  // Current backend at `burs_style_engine:995` reads `'reject'` and
  // penalizes `sig.garment_id` (a latent bug — outfit-level rejections
  // shouldn't poison individual garments). P88 fixes the read site to
  // penalize `outfit_id` instead. New `never_suggest_garment` carries
  // garment-level intent for the future "Never suggest this" UI in P86.
  reject: "reject_outfit",

  // Reaction legacy — collapse to `quick_reaction`. Direction info
  // (positive vs negative) goes into `metadata.value` at the write site;
  // P85 `memory_ingest` is responsible for enrichment.
  dislike: "quick_reaction",
  thumbs_down: "quick_reaction",
  like: "quick_reaction",

  // Dead enum — drop. P82 audit confirmed never emitted in production
  // code; member of the `useFeedbackSignals.SignalType` union but no
  // call site emits it.
  garment_edit: null,
});

/**
 * Normalize a legacy or current `signal_type` value to its canonical form.
 *
 * @param input - signal_type as stored or written. Case-sensitive — pass
 *   exactly as it appears in the database column.
 * @returns the canonical name, or `null` when the input is:
 *   - an empty string,
 *   - not a string,
 *   - a known dead enum (e.g., `garment_edit`),
 *   - unknown.
 *
 * The caller decides what to do with `null`. P85 `memory_ingest` logs a
 * warning + drops the event; readers (P88+P89) skip the row.
 *
 * @example
 *   normalizeStyleMemorySignal('save_outfit')   // 'save_outfit'  — passthrough
 *   normalizeStyleMemorySignal('save')          // 'save_outfit'  — legacy
 *   normalizeStyleMemorySignal('swap_choice')   // 'swap_garment' — legacy
 *   normalizeStyleMemorySignal('dislike')       // 'quick_reaction' (lossy — caller enriches metadata.value)
 *   normalizeStyleMemorySignal('garment_edit')  // null  — dead enum
 *   normalizeStyleMemorySignal('foobar')        // null  — unknown
 *   normalizeStyleMemorySignal('Save')          // null  — case-sensitive
 *   normalizeStyleMemorySignal('')              // null  — empty
 *   normalizeStyleMemorySignal(undefined)       // null  — non-string
 */
export function normalizeStyleMemorySignal(
  input: unknown,
): CanonicalStyleMemorySignal | null {
  if (typeof input !== "string" || input.length === 0) return null;
  // Object-property lookup with a defensive `Object.prototype.hasOwnProperty`
  // check avoids accidental hits on inherited properties (e.g., `toString`).
  if (!Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, input)) {
    return null;
  }
  const result = LEGACY_TO_CANONICAL[input];
  return result ?? null;
}
