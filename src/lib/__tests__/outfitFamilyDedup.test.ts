/**
 * Tests for outfit family deduplication logic.
 * Mirrors helpers from burs_style_engine to verify:
 *  - exact duplicates removed
 *  - near-duplicate families collapsed
 *  - materially different outfits preserved
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored types ──

interface GarmentRow {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  color_primary: string;
  color_secondary: string | null;
  pattern: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
  image_path: string;
}

interface ComboItem {
  slot: string;
  garment: GarmentRow;
  baseScore: number;
  baseBreakdown: Record<string, number>;
}

interface ScoredCombo {
  items: ComboItem[];
  totalScore: number;
  breakdown: Record<string, number>;
}

interface OutfitFamilySignature {
  slotStructure: string;
  colorDirection: string;
  formalityBand: string;
  fitSilhouette: string;
  categoryKey: string;
}

interface DeduplicatedCombo extends ScoredCombo {
  family_label: string;
  variation_reason: string;
}

// ── Mirrored helpers ──

function fitFamily(fit: string | null | undefined): string {
  const v = String(fit || '').toLowerCase();
  if (['oversized', 'relaxed', 'loose', 'wide'].some(x => v.includes(x))) return 'relaxed';
  if (['slim', 'skinny', 'fitted', 'tailored'].some(x => v.includes(x))) return 'fitted';
  return 'regular';
}

const COLOR_HSL: Record<string, [number, number, number]> = {
  black: [0, 0, 5], white: [0, 0, 95], gray: [0, 0, 50], grey: [0, 0, 50],
  navy: [230, 60, 25], blue: [220, 70, 50], red: [0, 75, 50], green: [140, 50, 40],
  beige: [40, 30, 75], brown: [25, 50, 35], pink: [340, 60, 70], yellow: [50, 90, 55],
  orange: [25, 90, 55], purple: [280, 50, 45], teal: [180, 50, 40],
};

function getHSL(color: string): [number, number, number] | null {
  return COLOR_HSL[String(color || '').toLowerCase().trim()] || null;
}

function isNeutral(hsl: [number, number, number]): boolean {
  return hsl[1] < 15;
}

function getColorTemperatureLabel(color: string): string {
  const hsl = getHSL(color);
  if (!hsl) return 'neutral';
  if (isNeutral(hsl)) return 'neutral';
  const [h] = hsl;
  if (h >= 0 && h < 60) return 'warm';
  if (h >= 60 && h < 150) return 'warm-green';
  if (h >= 150 && h < 270) return 'cool';
  return 'warm';
}

function getColorBoldness(color: string): string {
  const hsl = getHSL(color);
  if (!hsl) return 'muted';
  const [, s, l] = hsl;
  if (s > 60 && l > 30 && l < 70) return 'bold';
  return 'muted';
}

function getFormalityBand(formality: number | null): string {
  const f = formality ?? 5;
  if (f <= 3) return 'casual';
  if (f <= 6) return 'smart-casual';
  return 'formal';
}

function buildOutfitFamilySignature(items: ComboItem[]): OutfitFamilySignature {
  const sorted = [...items].sort((a, b) => a.slot.localeCompare(b.slot));
  const slotStructure = sorted.map(i => i.slot).join('+');
  const temps = sorted.map(i => getColorTemperatureLabel(i.garment.color_primary));
  const boldness = sorted.map(i => getColorBoldness(i.garment.color_primary));
  const dominantTemp = temps.find(t => t !== 'neutral') || 'neutral';
  const hasBold = boldness.includes('bold');
  const colorDirection = `${dominantTemp}-${hasBold ? 'bold' : 'muted'}`;
  const formalities = sorted.map(i => i.garment.formality).filter((v): v is number => typeof v === 'number');
  const avgFormality = formalities.length > 0 ? formalities.reduce((s, v) => s + v, 0) / formalities.length : 5;
  const formalityBand = getFormalityBand(avgFormality);
  const fitSilhouette = sorted.map(i => fitFamily(i.garment.fit)).join('-');
  const categoryKey = sorted.map(i => (i.garment.subcategory || i.garment.category || '').toLowerCase().slice(0, 12)).join('/');
  return { slotStructure, colorDirection, formalityBand, fitSilhouette, categoryKey };
}

function outfitFamilySimilarity(a: OutfitFamilySignature, b: OutfitFamilySignature): number {
  let sim = 0;
  if (a.slotStructure === b.slotStructure) sim += 1;
  if (a.colorDirection === b.colorDirection) sim += 1;
  if (a.formalityBand === b.formalityBand) sim += 1;
  if (a.fitSilhouette === b.fitSilhouette) sim += 1;
  if (a.categoryKey === b.categoryKey) sim += 1;
  return sim / 5;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pickRepresentativeOutfits(combos: ScoredCombo[], maxResults = 10, threshold = 0.8): DeduplicatedCombo[] {
  if (combos.length === 0) return [];
  const sorted = [...combos].sort((a, b) => b.totalScore - a.totalScore);
  const picked: { combo: ScoredCombo; sig: OutfitFamilySignature }[] = [];
  for (const combo of sorted) {
    const sig = buildOutfitFamilySignature(combo.items);
    let tooSimilar = false;
    for (const existing of picked) {
      const sim = outfitFamilySimilarity(sig, existing.sig);
      if (sim >= threshold) {
        const aIds = new Set(combo.items.map(i => i.garment.id));
        const bIds = new Set(existing.combo.items.map(i => i.garment.id));
        if (jaccardSimilarity(aIds, bIds) >= 0.4 || sim >= 1.0) {
          tooSimilar = true;
          break;
        }
      }
    }
    if (!tooSimilar) {
      picked.push({ combo, sig });
      if (picked.length >= maxResults) break;
    }
  }
  return picked.map(({ combo }) => ({ ...combo, family_label: 'classic', variation_reason: '' }));
}

// ── Helpers ──

function makeGarment(overrides: Partial<GarmentRow> & { id: string; category: string; color_primary: string }): GarmentRow {
  return {
    title: overrides.id, subcategory: null, color_secondary: null, pattern: null,
    material: null, fit: null, formality: null, season_tags: null,
    wear_count: 0, last_worn_at: null, image_path: 'test.jpg', ...overrides,
  };
}

function makeItem(slot: string, g: GarmentRow, score = 7): ComboItem {
  return { slot, garment: g, baseScore: score, baseBreakdown: {} };
}

function makeCombo(items: ComboItem[], score: number): ScoredCombo {
  return { items, totalScore: score, breakdown: { overall: score, practicality: 7 } };
}

// ── Tests ──

describe('Exact duplicates removed', () => {
  it('removes combos with identical garment ids', () => {
    const top = makeGarment({ id: 't1', category: 'top', color_primary: 'black' });
    const bot = makeGarment({ id: 'b1', category: 'bottom', color_primary: 'navy' });
    const shoe = makeGarment({ id: 's1', category: 'shoes', color_primary: 'white' });

    const items = [makeItem('top', top), makeItem('bottom', bot), makeItem('shoes', shoe)];
    const combo1 = makeCombo(items, 8);
    const combo2 = makeCombo(items, 7.5); // same garments, lower score

    const result = pickRepresentativeOutfits([combo1, combo2], 10, 0.8);
    // Identical signature + jaccard=1 → collapsed to 1
    expect(result.length).toBe(1);
    expect(result[0].totalScore).toBe(8);
  });
});

describe('Near-duplicate families collapsed', () => {
  it('collapses combos with same structure/color/formality/fit/category', () => {
    // Two combos: different garment IDs but same categories, colors, fits, formality
    const combo1 = makeCombo([
      makeItem('top', makeGarment({ id: 't1', category: 'top', subcategory: 'shirt', color_primary: 'white', fit: 'regular', formality: 5 })),
      makeItem('bottom', makeGarment({ id: 'b1', category: 'bottom', subcategory: 'jeans', color_primary: 'blue', fit: 'regular', formality: 4 })),
      makeItem('shoes', makeGarment({ id: 's1', category: 'shoes', subcategory: 'sneakers', color_primary: 'white', fit: 'regular', formality: 3 })),
    ], 8);

    const combo2 = makeCombo([
      makeItem('top', makeGarment({ id: 't2', category: 'top', subcategory: 'shirt', color_primary: 'white', fit: 'regular', formality: 5 })),
      makeItem('bottom', makeGarment({ id: 'b2', category: 'bottom', subcategory: 'jeans', color_primary: 'blue', fit: 'regular', formality: 4 })),
      makeItem('shoes', makeGarment({ id: 's2', category: 'shoes', subcategory: 'sneakers', color_primary: 'white', fit: 'regular', formality: 3 })),
    ], 7);

    const result = pickRepresentativeOutfits([combo1, combo2], 10, 0.8);
    // 5/5 signature match (sim=1.0) → collapsed even though jaccard=0
    expect(result.length).toBe(1);
    expect(result[0].totalScore).toBe(8); // keeps the better one
  });
});

describe('Materially different outfits preserved', () => {
  it('keeps combos with different color/formality/fit families', () => {
    // Casual relaxed outfit
    const casual = makeCombo([
      makeItem('top', makeGarment({ id: 't1', category: 'top', subcategory: 'hoodie', color_primary: 'gray', fit: 'oversized', formality: 2 })),
      makeItem('bottom', makeGarment({ id: 'b1', category: 'bottom', subcategory: 'joggers', color_primary: 'black', fit: 'relaxed', formality: 2 })),
      makeItem('shoes', makeGarment({ id: 's1', category: 'shoes', subcategory: 'sneakers', color_primary: 'white', fit: 'regular', formality: 2 })),
    ], 7.5);

    // Formal fitted outfit
    const formal = makeCombo([
      makeItem('top', makeGarment({ id: 't2', category: 'top', subcategory: 'blazer', color_primary: 'navy', fit: 'tailored', formality: 8 })),
      makeItem('bottom', makeGarment({ id: 'b2', category: 'bottom', subcategory: 'trousers', color_primary: 'gray', fit: 'slim', formality: 8 })),
      makeItem('shoes', makeGarment({ id: 's2', category: 'shoes', subcategory: 'loafers', color_primary: 'brown', fit: 'regular', formality: 7 })),
    ], 8);

    // Bold colorful outfit
    const bold = makeCombo([
      makeItem('top', makeGarment({ id: 't3', category: 'top', subcategory: 'shirt', color_primary: 'red', fit: 'regular', formality: 5 })),
      makeItem('bottom', makeGarment({ id: 'b3', category: 'bottom', subcategory: 'chinos', color_primary: 'beige', fit: 'regular', formality: 5 })),
      makeItem('shoes', makeGarment({ id: 's3', category: 'shoes', subcategory: 'boots', color_primary: 'black', fit: 'regular', formality: 5 })),
    ], 7);

    const result = pickRepresentativeOutfits([casual, formal, bold], 10, 0.8);
    // All three differ in formality band, fit silhouette, color direction, and categories
    expect(result.length).toBe(3);
  });

  it('preserves dress-based vs top+bottom combos', () => {
    const dressCombo = makeCombo([
      makeItem('dress', makeGarment({ id: 'd1', category: 'dress', color_primary: 'red', formality: 6 })),
      makeItem('shoes', makeGarment({ id: 's1', category: 'shoes', color_primary: 'black', formality: 5 })),
    ], 7.5);

    const standardCombo = makeCombo([
      makeItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'white', formality: 5 })),
      makeItem('bottom', makeGarment({ id: 'b1', category: 'bottom', color_primary: 'navy', formality: 5 })),
      makeItem('shoes', makeGarment({ id: 's2', category: 'shoes', color_primary: 'white', formality: 4 })),
    ], 8);

    const result = pickRepresentativeOutfits([dressCombo, standardCombo], 10, 0.8);
    expect(result.length).toBe(2); // different slot structures
  });
});

describe('Signature building', () => {
  it('produces consistent signatures for identical garment metadata', () => {
    const items = [
      makeItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'black', fit: 'slim', formality: 6 })),
      makeItem('bottom', makeGarment({ id: 'b1', category: 'bottom', color_primary: 'navy', fit: 'regular', formality: 5 })),
    ];
    const sig1 = buildOutfitFamilySignature(items);
    const sig2 = buildOutfitFamilySignature(items);
    expect(outfitFamilySimilarity(sig1, sig2)).toBe(1);
  });
});
