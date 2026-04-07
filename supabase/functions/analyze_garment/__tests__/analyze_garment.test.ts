import { describe, expect, it } from 'vitest';

/**
 * These tests cover the pure normalizer logic from analyze_garment/index.ts.
 * Functions are inlined here because the edge function doesn't export them.
 * If they drift, they should be extracted to _shared.
 */

// ── normalizeCategory (mirror of analyze_garment/index.ts:46-60) ──

function normalizeCategory(cat: string): string {
  const catLower = cat.toLowerCase().trim();
  const categoryMap: Record<string, string> = {
    'top': 'top', 'överdel': 'top', 'tröja': 'top', 'skjorta': 'top',
    't-shirt': 'top', 'blus': 'top',
    'bottom': 'bottom', 'underdel': 'bottom', 'byxa': 'bottom',
    'byxor': 'bottom', 'jeans': 'bottom', 'kjol': 'bottom',
    'shoes': 'shoes', 'skor': 'shoes', 'sko': 'shoes',
    'outerwear': 'outerwear', 'ytterkläder': 'outerwear',
    'jacka': 'outerwear', 'kappa': 'outerwear',
    'accessory': 'accessory', 'accessoar': 'accessory', 'väska': 'accessory',
    'dress': 'dress', 'klänning': 'dress',
  };
  return categoryMap[catLower] || 'top';
}

// ── normalizeColor (mirror of analyze_garment/index.ts:62-82) ──

function normalizeColor(color: string): string {
  const colorLower = color.toLowerCase().trim();
  const colorMap: Record<string, string> = {
    'black': 'black', 'white': 'white', 'grey': 'grey', 'gray': 'grey',
    'blue': 'blue', 'navy': 'navy', 'beige': 'beige', 'cream': 'beige',
    'brown': 'brown', 'green': 'green', 'red': 'red', 'pink': 'pink',
    'purple': 'purple', 'yellow': 'yellow', 'orange': 'orange',
    'svart': 'black', 'vit': 'white', 'vitt': 'white',
    'grå': 'grey', 'grått': 'grey',
    'blå': 'blue', 'blått': 'blue',
    'marinblå': 'navy', 'marin': 'navy',
    'kräm': 'beige',
    'brun': 'brown', 'brunt': 'brown',
    'grön': 'green', 'grönt': 'green',
    'röd': 'red', 'rött': 'red',
    'rosa': 'pink',
    'lila': 'purple', 'violet': 'purple',
    'gul': 'yellow', 'gult': 'yellow',
  };
  return colorMap[colorLower] || colorLower;
}

// ── normalizeSeasonTags (mirror of analyze_garment/index.ts:84-103) ──

function normalizeSeasonTags(tags: string[]): string[] {
  const normalized: Set<string> = new Set();
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    if (tagLower.includes('summer') || tagLower.includes('sommar')) {
      normalized.add('summer');
    } else if (tagLower.includes('winter') || tagLower.includes('vinter')) {
      normalized.add('winter');
    } else if (tagLower.includes('spring') || tagLower.includes('vår') ||
               tagLower.includes('autumn') || tagLower.includes('fall') || tagLower.includes('höst')) {
      normalized.add('spring');
      normalized.add('autumn');
    } else if (tagLower.includes('all') || tagLower.includes('year') || tagLower.includes('året')) {
      normalized.add('spring'); normalized.add('summer');
      normalized.add('autumn'); normalized.add('winter');
    }
  }
  if (normalized.size === 0) return ['spring', 'summer', 'autumn', 'winter'];
  return Array.from(normalized);
}

// ── cleanJsonResponse (mirror of analyze_garment/index.ts:210-222) ──

function cleanJsonResponse(raw: string): string {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  s = s.replace(/,\s*([\]}])/g, '$1');
  s = s.replace(/(\d+)\.\s*([\]},])/g, '$1$2');
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  return s;
}

// ── Tests ──

describe('normalizeCategory', () => {
  it('maps English category names', () => {
    expect(normalizeCategory('top')).toBe('top');
    expect(normalizeCategory('bottom')).toBe('bottom');
    expect(normalizeCategory('shoes')).toBe('shoes');
    expect(normalizeCategory('outerwear')).toBe('outerwear');
    expect(normalizeCategory('dress')).toBe('dress');
    expect(normalizeCategory('accessory')).toBe('accessory');
  });

  it('maps Swedish category names', () => {
    expect(normalizeCategory('överdel')).toBe('top');
    expect(normalizeCategory('tröja')).toBe('top');
    expect(normalizeCategory('skjorta')).toBe('top');
    expect(normalizeCategory('blus')).toBe('top');
    expect(normalizeCategory('underdel')).toBe('bottom');
    expect(normalizeCategory('byxa')).toBe('bottom');
    expect(normalizeCategory('byxor')).toBe('bottom');
    expect(normalizeCategory('kjol')).toBe('bottom');
    expect(normalizeCategory('skor')).toBe('shoes');
    expect(normalizeCategory('sko')).toBe('shoes');
    expect(normalizeCategory('ytterkläder')).toBe('outerwear');
    expect(normalizeCategory('jacka')).toBe('outerwear');
    expect(normalizeCategory('kappa')).toBe('outerwear');
    expect(normalizeCategory('accessoar')).toBe('accessory');
    expect(normalizeCategory('väska')).toBe('accessory');
    expect(normalizeCategory('klänning')).toBe('dress');
  });

  it('is case insensitive', () => {
    expect(normalizeCategory('TOP')).toBe('top');
    expect(normalizeCategory('Shoes')).toBe('shoes');
    expect(normalizeCategory('DRESS')).toBe('dress');
  });

  it('defaults unknown categories to top', () => {
    expect(normalizeCategory('unknown')).toBe('top');
    expect(normalizeCategory('xyz')).toBe('top');
  });
});

describe('normalizeColor', () => {
  it('maps English color names', () => {
    expect(normalizeColor('black')).toBe('black');
    expect(normalizeColor('white')).toBe('white');
    expect(normalizeColor('gray')).toBe('grey');
    expect(normalizeColor('grey')).toBe('grey');
    expect(normalizeColor('cream')).toBe('beige');
    expect(normalizeColor('navy')).toBe('navy');
  });

  it('maps Swedish color names', () => {
    expect(normalizeColor('svart')).toBe('black');
    expect(normalizeColor('vit')).toBe('white');
    expect(normalizeColor('vitt')).toBe('white');
    expect(normalizeColor('grå')).toBe('grey');
    expect(normalizeColor('grått')).toBe('grey');
    expect(normalizeColor('blå')).toBe('blue');
    expect(normalizeColor('marinblå')).toBe('navy');
    expect(normalizeColor('marin')).toBe('navy');
    expect(normalizeColor('brun')).toBe('brown');
    expect(normalizeColor('grön')).toBe('green');
    expect(normalizeColor('röd')).toBe('red');
    expect(normalizeColor('rosa')).toBe('pink');
    expect(normalizeColor('lila')).toBe('purple');
    expect(normalizeColor('gul')).toBe('yellow');
  });

  it('passes through unknown colors unchanged', () => {
    expect(normalizeColor('olive')).toBe('olive');
    expect(normalizeColor('teal')).toBe('teal');
    expect(normalizeColor('burgundy')).toBe('burgundy');
  });
});

describe('normalizeSeasonTags', () => {
  it('returns all 4 seasons when input is empty', () => {
    expect(normalizeSeasonTags([])).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });

  it('normalizes English season names', () => {
    expect(normalizeSeasonTags(['summer'])).toEqual(['summer']);
    expect(normalizeSeasonTags(['winter'])).toEqual(['winter']);
  });

  it('normalizes Swedish season names', () => {
    expect(normalizeSeasonTags(['sommar'])).toEqual(['summer']);
    expect(normalizeSeasonTags(['vinter'])).toEqual(['winter']);
  });

  it('spring/autumn are always paired', () => {
    const result = normalizeSeasonTags(['spring']);
    expect(result).toContain('spring');
    expect(result).toContain('autumn');
  });

  it('handles "all year" tags', () => {
    const result = normalizeSeasonTags(['all year']);
    expect(result).toHaveLength(4);
    expect(result).toContain('spring');
    expect(result).toContain('summer');
    expect(result).toContain('autumn');
    expect(result).toContain('winter');
  });

  it('returns all 4 seasons for unrecognized tags', () => {
    expect(normalizeSeasonTags(['xyz'])).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });
});

describe('cleanJsonResponse', () => {
  it('removes markdown fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });

  it('removes trailing commas', () => {
    expect(cleanJsonResponse('{"a": 1, "b": 2,}')).toBe('{"a": 1, "b": 2}');
    expect(cleanJsonResponse('{"arr": [1, 2,]}')).toBe('{"arr": [1, 2]}');
  });

  it('repairs truncated decimal numbers', () => {
    expect(cleanJsonResponse('{"confidence": 0.}')).toBe('{"confidence": 0}');
  });

  it('extracts JSON from surrounding text', () => {
    const input = 'Here is the result: {"key": "value"} end of response';
    expect(cleanJsonResponse(input)).toBe('{"key": "value"}');
  });

  it('handles clean JSON unchanged', () => {
    const input = '{"title": "Blue shirt", "category": "top"}';
    expect(cleanJsonResponse(input)).toBe(input);
  });
});
