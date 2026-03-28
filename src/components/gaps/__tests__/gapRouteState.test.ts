import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildGapsPath,
  loadGapSnapshot,
  readGapNavigationIntent,
  saveGapSnapshot,
} from '../gapRouteState';

describe('gapRouteState', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('builds the canonical gaps paths', () => {
    expect(buildGapsPath()).toBe('/gaps');
    expect(buildGapsPath({ autorun: true })).toBe('/gaps?autorun=1');
  });

  it('reads autorun intent from search or location state', () => {
    expect(
      readGapNavigationIntent({
        search: '?autorun=1',
        state: null,
      }),
    ).toEqual({
      autorun: true,
      source: 'unknown',
    });

    expect(
      readGapNavigationIntent({
        search: '',
        state: { autorun: true, source: 'home' },
      }),
    ).toEqual({
      autorun: true,
      source: 'home',
    });
  });

  it('stores and loads snapshots per user without cross-user leakage', () => {
    saveGapSnapshot('user-a', {
      analyzedAt: '2026-03-28T00:00:00.000Z',
      results: [
        {
          item: 'Navy blazer',
          category: 'outerwear',
          color: 'navy',
          reason: 'Adds polish.',
          new_outfits: 4,
          price_range: '$120-$180',
          search_query: 'navy blazer',
        },
      ],
    });

    expect(loadGapSnapshot('user-a')?.results[0]?.item).toBe('Navy blazer');
    expect(loadGapSnapshot('user-b')).toBeNull();
    expect(loadGapSnapshot(undefined)).toBeNull();
  });
});
