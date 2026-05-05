/**
 * Wave 8.5 PR B — frontend mirror of the canonical Style Memory signal type.
 *
 * The source of truth lives in the shared edge-function module
 * `supabase/functions/_shared/style-memory-signals.ts`. This file mirrors the
 * union so the frontend doesn't reach across the supabase/ boundary (which
 * would break Vite's bundling — Vite can't follow Deno-style ESM URL imports).
 *
 * Keep both lists in lockstep. The
 * `_shared/__tests__/style-memory-signals.test.ts` suite asserts mutual
 * coverage between the two unions.
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
