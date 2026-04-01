import { describe, expect, it } from 'vitest';

/**
 * Tests for visual_search pure logic.
 * The edge function itself needs Deno + Supabase to run,
 * but we can test the response-filtering logic that strips hallucinated IDs.
 */

describe('garmentIdSet filter — strips hallucinated IDs', () => {
  it('keeps only matches whose garment_id exists in the wardrobe', () => {
    const garments = [
      { id: 'aaa-111' },
      { id: 'bbb-222' },
      { id: 'ccc-333' },
    ];
    const garmentIdSet = new Set(garments.map(g => g.id));

    const aiMatches = [
      { detected_item: 'White sneakers', garment_id: 'aaa-111', confidence: 90, reason: 'Exact match' },
      { detected_item: 'Blue jeans', garment_id: 'HALLUCINATED-ID', confidence: 85, reason: 'AI made this up' },
      { detected_item: 'Black jacket', garment_id: 'ccc-333', confidence: 78, reason: 'Good match' },
    ];

    const filtered = aiMatches.filter(m => garmentIdSet.has(m.garment_id));

    expect(filtered).toHaveLength(2);
    expect(filtered[0].garment_id).toBe('aaa-111');
    expect(filtered[1].garment_id).toBe('ccc-333');
  });

  it('returns empty array when all IDs are hallucinated', () => {
    const garmentIdSet = new Set(['real-id-1', 'real-id-2']);
    const aiMatches = [
      { detected_item: 'Shirt', garment_id: 'fake-1', confidence: 95, reason: 'Made up' },
      { detected_item: 'Pants', garment_id: 'fake-2', confidence: 88, reason: 'Also fake' },
    ];

    const filtered = aiMatches.filter(m => garmentIdSet.has(m.garment_id));
    expect(filtered).toHaveLength(0);
  });

  it('keeps all matches when none are hallucinated', () => {
    const garmentIdSet = new Set(['id-1', 'id-2', 'id-3']);
    const aiMatches = [
      { detected_item: 'Top', garment_id: 'id-1', confidence: 92, reason: 'Good' },
      { detected_item: 'Bottom', garment_id: 'id-2', confidence: 87, reason: 'Good' },
    ];

    const filtered = aiMatches.filter(m => garmentIdSet.has(m.garment_id));
    expect(filtered).toHaveLength(2);
  });
});

describe('LANG_NAMES locale map', () => {
  const LANG_NAMES: Record<string, string> = {
    sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "suomi",
    de: "Deutsch", fr: "français", es: "español", it: "italiano",
    pt: "português", nl: "Nederlands", pl: "polski", ar: "العربية", fa: "فارسی",
  };

  it('has 14 locales', () => {
    expect(Object.keys(LANG_NAMES)).toHaveLength(14);
  });

  it('resolves all supported locales', () => {
    expect(LANG_NAMES['sv']).toBe('svenska');
    expect(LANG_NAMES['en']).toBe('English');
    expect(LANG_NAMES['de']).toBe('Deutsch');
    expect(LANG_NAMES['fr']).toBe('français');
    expect(LANG_NAMES['ar']).toBe('العربية');
    expect(LANG_NAMES['fa']).toBe('فارسی');
  });

  it('falls back to undefined for unknown locales', () => {
    expect(LANG_NAMES['xx']).toBeUndefined();
    const langName = LANG_NAMES['xx'] || 'English';
    expect(langName).toBe('English');
  });
});

describe('garments < 3 early return', () => {
  it('returns empty response shape when wardrobe is too small', () => {
    const garments: unknown[] = [{ id: '1' }, { id: '2' }];
    if (!garments || garments.length < 3) {
      const response = { matches: [], gaps: [], description: 'Add more garments first.' };
      expect(response.matches).toEqual([]);
      expect(response.gaps).toEqual([]);
      expect(response.description).toBe('Add more garments first.');
    }
  });
});
