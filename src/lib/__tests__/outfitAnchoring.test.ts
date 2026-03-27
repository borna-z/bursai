import { describe, expect, it } from 'vitest';
import { hasPreferredGarmentMatch, normalizePreferredGarmentIds } from '../outfitAnchoring';

describe('outfitAnchoring', () => {
  it('normalizes and deduplicates preferred garment ids', () => {
    expect(normalizePreferredGarmentIds([' g-1 ', 'g-2', '', 'g-1', undefined, null])).toEqual([
      'g-1',
      'g-2',
    ]);
  });

  it('treats empty preferred ids as non-blocking', () => {
    expect(hasPreferredGarmentMatch(['g-1', 'g-2'], [])).toBe(true);
  });

  it('detects when an outfit includes a preferred garment', () => {
    expect(hasPreferredGarmentMatch(['g-1', 'g-2', 'g-3'], ['g-9', 'g-2'])).toBe(true);
    expect(hasPreferredGarmentMatch(['g-1', 'g-2', 'g-3'], ['g-9', 'g-8'])).toBe(false);
  });
});
