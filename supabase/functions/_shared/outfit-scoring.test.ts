import { describe, expect, it } from 'vitest';

import {
  RECENT_SUGGESTION_BONUS_MIN_HISTORY,
  RECENT_SUGGESTION_FRESHNESS_BONUS,
  RECENT_SUGGESTION_MAX_PENALTY,
  RECENT_SUGGESTION_WINDOW,
  isLowVariety,
  recentSuggestionPenalty,
} from './outfit-scoring';

describe('recentSuggestionPenalty', () => {
  it('returns 0 for a null map', () => {
    expect(recentSuggestionPenalty('g1', null)).toBe(0);
  });

  it('returns 0 for an empty map', () => {
    expect(recentSuggestionPenalty('g1', new Map())).toBe(0);
  });

  it('returns the freshness bonus when the garment is missing from a map with sufficient history', () => {
    // History at the gating threshold — bonus fires for missing garments.
    const map = new Map<string, number>([
      ['other-a', 1],
      ['other-b', 2],
      ['other-c', 3],
    ]);
    expect(map.size).toBeGreaterThanOrEqual(RECENT_SUGGESTION_BONUS_MIN_HISTORY);
    expect(recentSuggestionPenalty('g1', map)).toBe(RECENT_SUGGESTION_FRESHNESS_BONUS);
  });

  it('suppresses the freshness bonus when the recency history is too small to be informative', () => {
    // Audit P3: under the prior contract, the first generate produced 0 for
    // every garment (empty map) but the SECOND generate suddenly stamped
    // +bonus on 95% of the wardrobe (single-entry map). That step change
    // produced visible re-ranking even though the only "signal" was a
    // single past suggestion. The gate suppresses the bonus until at least
    // `RECENT_SUGGESTION_BONUS_MIN_HISTORY` entries accumulate.
    for (let n = 1; n < RECENT_SUGGESTION_BONUS_MIN_HISTORY; n++) {
      const map = new Map<string, number>();
      for (let i = 0; i < n; i++) map.set(`other-${i}`, i + 1);
      expect(recentSuggestionPenalty('g1', map)).toBe(0);
    }
  });

  it('returns the maximum penalty at rank 1', () => {
    const map = new Map<string, number>([['g1', 1]]);
    expect(recentSuggestionPenalty('g1', map)).toBeCloseTo(-RECENT_SUGGESTION_MAX_PENALTY);
  });

  it('decays to ~0 at the window boundary', () => {
    const map = new Map<string, number>([['g1', RECENT_SUGGESTION_WINDOW]]);
    const expected = -RECENT_SUGGESTION_MAX_PENALTY * (1 / RECENT_SUGGESTION_WINDOW);
    expect(recentSuggestionPenalty('g1', map)).toBeCloseTo(expected);
  });

  it('floors at 0 for ranks past the window (no negative leak)', () => {
    const map = new Map<string, number>([['g1', RECENT_SUGGESTION_WINDOW + 5]]);
    // `toEqual` treats -0 and +0 as equal — `toBe` uses Object.is and trips
    // on a stray negative zero from `-N * 0`. The semantic ("no negative
    // leak") is satisfied by either representation.
    expect(recentSuggestionPenalty('g1', map)).toEqual(0);
  });

  it('decays monotonically from rank 1 to the window boundary', () => {
    const map = new Map<string, number>([['g1', 1]]);
    let prev = recentSuggestionPenalty('g1', map);
    for (let r = 2; r <= RECENT_SUGGESTION_WINDOW; r++) {
      map.set('g1', r);
      const cur = recentSuggestionPenalty('g1', map);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('is deterministic for identical inputs', () => {
    const map = new Map<string, number>([
      ['g1', 3],
      ['g2', 1],
      ['g3', 18],
    ]);
    const a = recentSuggestionPenalty('g1', map);
    const b = recentSuggestionPenalty('g1', map);
    expect(a).toBe(b);
  });

  it('treats sub-1 ranks as worst-case (no overflow)', () => {
    const map = new Map<string, number>([['g1', 0]]);
    expect(recentSuggestionPenalty('g1', map)).toBe(-RECENT_SUGGESTION_MAX_PENALTY);
  });
});

describe('isLowVariety', () => {
  // Audit P2: the AI-success path and the deterministic-fallback path must
  // surface the same `low_variety` signal for the same recency state. The
  // shared helper guarantees that — these tests pin the contract.

  it('returns false on a null or empty recency map', () => {
    expect(isLowVariety(null, ['a', 'b'])).toBe(false);
    expect(isLowVariety(new Map(), ['a', 'b'])).toBe(false);
  });

  it('returns false when the chosen outfit is empty', () => {
    const map = new Map<string, number>([['a', 1]]);
    expect(isLowVariety(map, [])).toBe(false);
  });

  it('flips to true when at least half of the chosen items are in the last 3 logged suggestions', () => {
    // 4-item outfit; 2 items at ranks within the last-3 window → 2 >= ceil(4/2) = 2.
    const map = new Map<string, number>([
      ['top', 1],
      ['bottom', 3],
      // shoes + outer not present in recent log
    ]);
    expect(isLowVariety(map, ['top', 'bottom', 'shoes', 'outer'])).toBe(true);
  });

  it('stays false when fewer than half of the chosen items repeat', () => {
    // 4-item outfit; only 1 in the last-3 window → 1 < ceil(4/2) = 2.
    const map = new Map<string, number>([
      ['top', 1],
      ['old-tee', 7],
      ['old-jacket', 12],
    ]);
    expect(isLowVariety(map, ['top', 'bottom', 'shoes', 'outer'])).toBe(false);
  });

  it('ignores recency entries past the last-3 window', () => {
    // All chosen items appear in the map but at ranks > 3 — should NOT
    // trip low_variety. The signal is specifically "shown to the user
    // very recently."
    const map = new Map<string, number>([
      ['a', 4],
      ['b', 8],
      ['c', 15],
    ]);
    expect(isLowVariety(map, ['a', 'b', 'c'])).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const map = new Map<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const a = isLowVariety(map, ['a', 'b', 'c']);
    const b = isLowVariety(map, ['a', 'b', 'c']);
    expect(a).toBe(b);
  });
});
