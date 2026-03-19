import { describe, expect, it } from 'vitest';

import { extractGarmentIdsFromText, parseGarmentTextSegments } from '../garmentTokens';

describe('extractGarmentIdsFromText', () => {
  it('extracts garment ids from legacy and labeled garment tags', () => {
    expect(
      extractGarmentIdsFromText(
        'Wear the blazer [[garment:11111111-1111-1111-1111-111111111111|Navy blazer]] with jeans [[garment:22222222-2222-2222-2222-222222222222]].',
      ),
    ).toEqual([
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
    ]);
  });

  it('extracts ids from outfit tags alongside garment tags', () => {
    expect(
      extractGarmentIdsFromText(
        'Try [[outfit:33333333-3333-3333-3333-333333333333,44444444-4444-4444-4444-444444444444|Works for dinner]] and add [[garment:55555555-5555-5555-5555-555555555555|Loafers]].',
      ),
    ).toEqual([
      '55555555-5555-5555-5555-555555555555',
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444',
    ]);
  });
});

describe('parseGarmentTextSegments', () => {
  it('parses both legacy and labeled garment tags in order', () => {
    expect(
      parseGarmentTextSegments(
        'Wear [[garment:11111111-1111-1111-1111-111111111111]] with [[garment:22222222-2222-2222-2222-222222222222|Black loafers]].',
      ),
    ).toEqual([
      { type: 'text', value: 'Wear' },
      { type: 'garment', id: '11111111-1111-1111-1111-111111111111', label: undefined },
      { type: 'text', value: 'with' },
      { type: 'garment', id: '22222222-2222-2222-2222-222222222222', label: 'Black loafers' },
      { type: 'text', value: '.' },
    ]);
  });
});
