import { describe, expect, it } from 'vitest';

import { extractGarmentIdsFromText, parseGarmentTextSegments, parseOutfitTags, stripUnknownGarmentMarkup } from '../garmentTokens';

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

describe('stripUnknownGarmentMarkup', () => {
  it('removes malformed double-bracket garment leakage while preserving valid tags', () => {
    expect(
      stripUnknownGarmentMarkup(
        'Keep the hoodie [[Givenchy Logo Tape Hoodie: relaxed fit]] with [[garment:11111111-1111-1111-1111-111111111111|Navy blazer]].',
      ),
    ).toBe('Keep the hoodie with [[garment:11111111-1111-1111-1111-111111111111|Navy blazer]].');
  });

  it('removes incomplete garment and outfit tags before they leak into prose', () => {
    expect(
      stripUnknownGarmentMarkup(
        'Change the pants [[garment:11111111-1111-1111-1111-111111111111 and keep it elegant [[outfit:11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222',
      ),
    ).toBe('Change the pants');
  });
});


describe('parseOutfitTags', () => {
  it('parses outfit tags into a single active-look snapshot payload', () => {
    expect(
      parseOutfitTags(
        'Updated look [[outfit:33333333-3333-3333-3333-333333333333,44444444-4444-4444-4444-444444444444|Sharper dinner balance]].',
      ),
    ).toEqual([
      {
        fullMatch: '[[outfit:33333333-3333-3333-3333-333333333333,44444444-4444-4444-4444-444444444444|Sharper dinner balance]]',
        ids: [
          '33333333-3333-3333-3333-333333333333',
          '44444444-4444-4444-4444-444444444444',
        ],
        explanation: 'Sharper dinner balance',
      },
    ]);
  });

  it('ignores truncated streaming outfit tags', () => {
    expect(
      parseOutfitTags(
        'Updated look [[outfit:33333333-3333-3333-3333-333333333333,44444444-4444-4444-4444-444444444444|Sharper dinner balance',
      ),
    ).toEqual([]);
  });
});
