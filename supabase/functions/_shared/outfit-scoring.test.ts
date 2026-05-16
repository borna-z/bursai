// Phase 0 — style engine variety. Pure-function tests for the recency
// adjustment. Run with: `deno test --allow-none _shared/outfit-scoring.test.ts`
// from `supabase/functions/`.

import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import {
  RECENT_SUGGESTION_FRESHNESS_BONUS,
  RECENT_SUGGESTION_MAX_PENALTY,
  RECENT_SUGGESTION_WINDOW,
  recentSuggestionPenalty,
} from "./outfit-scoring.ts";

Deno.test("recentSuggestionPenalty: null map returns 0", () => {
  assertEquals(recentSuggestionPenalty("g1", null), 0);
});

Deno.test("recentSuggestionPenalty: empty map returns 0", () => {
  assertEquals(recentSuggestionPenalty("g1", new Map()), 0);
});

Deno.test("recentSuggestionPenalty: garment missing from non-empty map → freshness bonus", () => {
  const map = new Map<string, number>([["other", 1]]);
  assertEquals(
    recentSuggestionPenalty("g1", map),
    RECENT_SUGGESTION_FRESHNESS_BONUS,
  );
});

Deno.test("recentSuggestionPenalty: rank 1 → max penalty", () => {
  const map = new Map<string, number>([["g1", 1]]);
  assertAlmostEquals(
    recentSuggestionPenalty("g1", map),
    -RECENT_SUGGESTION_MAX_PENALTY,
  );
});

Deno.test("recentSuggestionPenalty: rank window → ~0", () => {
  const map = new Map<string, number>([["g1", RECENT_SUGGESTION_WINDOW]]);
  const got = recentSuggestionPenalty("g1", map);
  // rank == window: decay = 1 - (window-1)/window = 1/window → small fraction
  // of max penalty. Still negative but well under the freshness bonus.
  const expected = -RECENT_SUGGESTION_MAX_PENALTY *
    (1 / RECENT_SUGGESTION_WINDOW);
  assertAlmostEquals(got, expected);
});

Deno.test("recentSuggestionPenalty: rank > window → 0 floor (no negative leak)", () => {
  const map = new Map<string, number>([
    ["g1", RECENT_SUGGESTION_WINDOW + 5],
  ]);
  assertEquals(recentSuggestionPenalty("g1", map), 0);
});

Deno.test("recentSuggestionPenalty: monotonic decay from rank 1 to window", () => {
  const map = new Map<string, number>([["g1", 1]]);
  let prev = recentSuggestionPenalty("g1", map);
  for (let r = 2; r <= RECENT_SUGGESTION_WINDOW; r++) {
    map.set("g1", r);
    const cur = recentSuggestionPenalty("g1", map);
    // Larger rank = less negative (penalty shrinks).
    if (cur < prev) {
      throw new Error(
        `Expected monotonic decay; got rank ${r}: ${cur} < prev ${prev}`,
      );
    }
    prev = cur;
  }
});

Deno.test("recentSuggestionPenalty: deterministic for identical inputs", () => {
  const map = new Map<string, number>([
    ["g1", 3],
    ["g2", 1],
    ["g3", 18],
  ]);
  const a = recentSuggestionPenalty("g1", map);
  const b = recentSuggestionPenalty("g1", map);
  assertEquals(a, b);
});

Deno.test("recentSuggestionPenalty: defensive against rank 0 or negative", () => {
  const map = new Map<string, number>([["g1", 0]]);
  // Treat sub-1 ranks as worst-case (most recent), not as overflow.
  assertEquals(recentSuggestionPenalty("g1", map), -RECENT_SUGGESTION_MAX_PENALTY);
});
