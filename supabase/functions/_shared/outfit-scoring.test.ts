import { describe, expect, it } from 'vitest';

import {
  RECENT_SUGGESTION_FRESHNESS_BONUS,
  RECENT_SUGGESTION_MAX_PENALTY,
  RECENT_SUGGESTION_WINDOW,
  recentSuggestionPenalty,
} from '../outfit-scoring';

describe('recentSuggestionPenalty', () => {
  it('returns 0 for a null map', () => {
    expect(recentSuggestionPenalty('g1', null)).toBe(0);
  });

  it('returns 0 for an empty map', () => {
    expect(recentSuggestionPenalty('g1', new Map())).toBe(0);
  });

  it('returns the freshness bonus when the garment is missing from a non-empty map', () => {
    const map = new Map<string, number>([['other', 1]]);
    expect(recentSuggestionPenalty('g1', map)).toBe(RECENT_SUGGESTION_FRESHNESS_BONUS);
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
    expect(recentSuggestionPenalty('g1', map)).toBe(0);
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
