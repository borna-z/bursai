/**
 * Wave 8.5 PR B — frontend mirror of the canonical Style Memory signal type.
 *
 * The source of truth lives in the shared edge-function module
 * `supabase/functions/_shared/style-memory-signals.ts`. This file mirrors the
 * union so the frontend doesn't reach across the supabase/ boundary (which
 * would break the Metro bundler — Metro can't follow Deno-style ESM URL
 * imports).
 *
 * Keep this in lockstep with `src/types/styleMemory.ts` (web). The shared
 * `_shared/__tests__/style-memory-signals.test.ts` suite asserts mutual
 * coverage between the two unions and the edge-function tuple. Owned by
 * mobile post-`src/`-deletion (N5 boundary lockdown — Codex P2 review on
 * PR #803).
 */

export type CanonicalStyleMemorySignal =
  | "save_outfit"
  | "unsave_outfit"
  | "rate_outfit"
  | "wear_outfit"
  | "skip_outfit"
  | "reject_outfit"
  | "swap_garment"
  | "quick_reaction"
  | "never_suggest_garment"
  | "like_pair"
  | "dislike_pair";

/**
 * Tuple form of the union — useful for runtime iteration / fixture coverage.
 * Order matches the type union for readability.
 */
export const CANONICAL_STYLE_MEMORY_SIGNALS_FRONTEND = [
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
