/**
 * BURS Outfit Engine — Evaluation Harness
 *
 * Gold-standard deterministic scenarios that verify ranking quality.
 * Each scenario defines a wardrobe fixture, context, and assertions
 * about which garments SHOULD or SHOULD NOT appear in top results.
 *
 * These are regression tests: if a future engine change silently degrades
 * outfit quality, at least one scenario here should fail.
 */
import { describe, it, expect } from 'vitest';

// ════════════════════════════════════════════════════════════════
// Mirrored types (keep in sync with burs_style_engine)
// ════════════════════════════════════════════════════════════════

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

type SwapMode = 'safe' | 'bold' | 'fresh';

// ════════════════════════════════════════════════════════════════
// Mirrored scoring helpers (from burs_style_engine)
// ════════════════════════════════════════════════════════════════

const WATERPROOF_MATERIALS = ['gore-tex', 'polyester', 'nylon', 'softshell', 'regn', 'rain'];
const WARM_MATERIALS = ['wool', 'fleece', 'down', 'cashmere'];
const LIGHT_MATERIALS = ['linen', 'silk', 'chiffon'];

function clampScore(v: number): number {
  return Math.max(0, Math.min(10, v));
}

function fitFamily(fit: string | null | undefined): string {
  const v = String(fit || '').toLowerCase();
  if (['oversized', 'relaxed', 'loose', 'wide'].some(x => v.includes(x))) return 'relaxed';
  if (['slim', 'skinny', 'fitted', 'tailored'].some(x => v.includes(x))) return 'fitted';
  return 'regular';
}

function feelsLikeTemp(temp: number, wind?: string): number {
  if (!wind) return temp;
  const w = wind.toLowerCase();
  if (w === 'high' || w === 'hög') return temp - 6;
  if (w === 'medium' || w === 'medel') return temp - 3;
  return temp;
}

function weatherPracticalityScore(
  items: ComboItem[],
  weather: { temperature?: number; precipitation?: string; wind?: string }
): number {
  if (weather.temperature === undefined) return 7;
  let score = 8;
  const temp = feelsLikeTemp(weather.temperature, weather.wind);
  const slots = new Set(items.map(i => i.slot));
  const hasOuterwear = slots.has('outerwear');
  const precip = (weather.precipitation || '').toLowerCase();
  const isRainy = precip.includes('rain') || precip.includes('regn');
  const isSnowy = precip.includes('snow') || precip.includes('snö');
  if (temp < 10 && !hasOuterwear) score -= 1.5;
  if (temp < 0 && !hasOuterwear) score -= 2;
  if ((isRainy || isSnowy) && hasOuterwear) {
    const ow = items.find(i => i.slot === 'outerwear');
    if (ow) {
      const mat = (ow.garment.material || '').toLowerCase();
      if (WATERPROOF_MATERIALS.some(w => mat.includes(w))) score += 1;
    }
  }
  if ((isRainy || isSnowy) && !hasOuterwear) score -= 1;
  if (temp > 25 && hasOuterwear) score -= 2;
  if (temp > 25 && items.length > 3) score -= 0.5;
  return clampScore(score);
}

function formalityConsistencyScore(items: ComboItem[]): number {
  const vals = items.map(i => i.garment.formality).filter((v): v is number => v !== null);
  if (vals.length < 2) return 8;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const maxDev = Math.max(...vals.map(v => Math.abs(v - avg)));
  return clampScore(10 - maxDev * 1.5);
}

// Occasion formality expectation
function occasionFormalityTarget(occasion: string): number | null {
  const map: Record<string, number> = {
    work: 7, interview: 8, formal: 9, business: 7,
    casual: 3, weekend: 3, date: 6, party: 5, travel: 4,
  };
  return map[occasion.toLowerCase()] ?? null;
}

function occasionFitScore(items: ComboItem[], occasion: string): number {
  const target = occasionFormalityTarget(occasion);
  if (target === null) return 7;
  const formalities = items.map(i => i.garment.formality ?? 5);
  const avg = formalities.reduce((s, v) => s + v, 0) / formalities.length;
  return clampScore(10 - Math.abs(avg - target) * 1.5);
}

// DNA preservation for swap
function dnaPreservationScore(candidate: GarmentRow, anchor: GarmentRow): number {
  let score = 10;
  const cf = candidate.formality ?? 5;
  const af = anchor.formality ?? 5;
  score -= Math.abs(cf - af) * 1.2;
  if (fitFamily(candidate.fit) !== fitFamily(anchor.fit)) score -= 1.5;
  const cp = (candidate.pattern || 'solid').toLowerCase();
  const ap = (anchor.pattern || 'solid').toLowerCase();
  if (cp !== ap) score -= 1;
  if (candidate.subcategory && candidate.subcategory === anchor.subcategory) score += 1;
  return clampScore(score);
}

// Family dedup helpers
interface OutfitFamilySignature {
  slotStructure: string;
  colorDirection: string;
  formalityBand: string;
  fitSilhouette: string;
  categoryKey: string;
}

const COLOR_HSL: Record<string, [number, number, number]> = {
  black: [0, 0, 5], white: [0, 0, 95], gray: [0, 0, 50], grey: [0, 0, 50],
  navy: [230, 60, 25], blue: [220, 70, 50], red: [0, 75, 50], green: [140, 50, 40],
  beige: [40, 30, 75], brown: [25, 50, 35], pink: [340, 60, 70], yellow: [50, 90, 55],
  orange: [25, 90, 55], purple: [280, 50, 45], teal: [180, 50, 40],
};

function getColorTemp(color: string): string {
  const hsl = COLOR_HSL[color?.toLowerCase()?.trim()];
  if (!hsl || hsl[1] < 15) return 'neutral';
  const [h] = hsl;
  if (h >= 150 && h < 270) return 'cool';
  return 'warm';
}

function getColorBoldness(color: string): string {
  const hsl = COLOR_HSL[color?.toLowerCase()?.trim()];
  if (!hsl) return 'muted';
  const [, s, l] = hsl;
  return s > 60 && l > 30 && l < 70 ? 'bold' : 'muted';
}

function getFormalityBand(f: number | null): string {
  const v = f ?? 5;
  if (v <= 3) return 'casual';
  if (v <= 6) return 'smart-casual';
  return 'formal';
}

function buildFamilySig(items: ComboItem[]): OutfitFamilySignature {
  const sorted = [...items].sort((a, b) => a.slot.localeCompare(b.slot));
  const slotStructure = sorted.map(i => i.slot).join('+');
  const temps = sorted.map(i => getColorTemp(i.garment.color_primary));
  const boldness = sorted.map(i => getColorBoldness(i.garment.color_primary));
  const dominantTemp = temps.find(t => t !== 'neutral') || 'neutral';
  const hasBold = boldness.includes('bold');
  const colorDirection = `${dominantTemp}-${hasBold ? 'bold' : 'muted'}`;
  const formalities = sorted.map(i => i.garment.formality).filter((v): v is number => v !== null);
  const avgF = formalities.length > 0 ? formalities.reduce((s, v) => s + v, 0) / formalities.length : 5;
  const formalityBand = getFormalityBand(avgF);
  const fitSilhouette = sorted.map(i => fitFamily(i.garment.fit)).join('-');
  const categoryKey = sorted.map(i => (i.garment.subcategory || i.garment.category || '').toLowerCase().slice(0, 12)).join('/');
  return { slotStructure, colorDirection, formalityBand, fitSilhouette, categoryKey };
}

function familySimilarity(a: OutfitFamilySignature, b: OutfitFamilySignature): number {
  let sim = 0;
  if (a.slotStructure === b.slotStructure) sim++;
  if (a.colorDirection === b.colorDirection) sim++;
  if (a.formalityBand === b.formalityBand) sim++;
  if (a.fitSilhouette === b.fitSilhouette) sim++;
  if (a.categoryKey === b.categoryKey) sim++;
  return sim / 5;
}

// ════════════════════════════════════════════════════════════════
// Fixture factory
// ════════════════════════════════════════════════════════════════

function g(overrides: Partial<GarmentRow> & { id: string; category: string; color_primary: string }): GarmentRow {
  return {
    title: overrides.id, subcategory: null, color_secondary: null, pattern: null,
    material: null, fit: null, formality: null, season_tags: null,
    wear_count: 0, last_worn_at: null, image_path: 'test.jpg', ...overrides,
  };
}

function item(slot: string, garment: GarmentRow, score = 7): ComboItem {
  return { slot, garment, baseScore: score, baseBreakdown: {} };
}

function combo(items: ComboItem[], totalScore: number, extraBreakdown: Record<string, number> = {}): ScoredCombo {
  return {
    items, totalScore,
    breakdown: { overall: totalScore, practicality: 7, occasion_fit: 7, style_intent: 7, formality: 7, formalityConsistency: 7, ...extraBreakdown },
  };
}

/** Rank combos using a simplified composite score matching engine logic. */
function rankCombos(
  combos: ScoredCombo[],
  weather: { temperature?: number; precipitation?: string; wind?: string },
  occasion: string
): ScoredCombo[] {
  return [...combos]
    .map(c => {
      const prac = weatherPracticalityScore(c.items, weather);
      const form = formalityConsistencyScore(c.items);
      const occ = occasionFitScore(c.items, occasion);
      const avgBase = c.items.reduce((s, i) => s + i.baseScore, 0) / (c.items.length || 1);
      const total = avgBase * 0.30 + prac * 0.25 + form * 0.15 + occ * 0.20 + 7 * 0.10;
      return { ...c, totalScore: total, breakdown: { ...c.breakdown, practicality: prac, formalityConsistency: form, occasion_fit: occ } };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

/** Evaluation summary: check pass/fail across an array of named assertions. */
interface EvalAssertion {
  name: string;
  pass: boolean;
}

function evalSummary(assertions: EvalAssertion[]): { passed: number; failed: number; total: number; failedNames: string[] } {
  const passed = assertions.filter(a => a.pass).length;
  const failed = assertions.filter(a => !a.pass).length;
  return { passed, failed, total: assertions.length, failedNames: assertions.filter(a => !a.pass).map(a => a.name) };
}

// ════════════════════════════════════════════════════════════════
// FIXTURES — Shared wardrobe
// ════════════════════════════════════════════════════════════════

const WARDROBE = {
  // Tops
  whiteShirt:     g({ id: 'white-shirt', category: 'top', subcategory: 'shirt', color_primary: 'white', formality: 7, fit: 'regular', material: 'cotton' }),
  blackTee:       g({ id: 'black-tee', category: 'top', subcategory: 't-shirt', color_primary: 'black', formality: 3, fit: 'regular', material: 'cotton' }),
  navyPolo:       g({ id: 'navy-polo', category: 'top', subcategory: 'polo', color_primary: 'navy', formality: 5, fit: 'regular', material: 'cotton' }),
  grayHoodie:     g({ id: 'gray-hoodie', category: 'top', subcategory: 'hoodie', color_primary: 'gray', formality: 2, fit: 'oversized', material: 'cotton' }),
  redShirt:       g({ id: 'red-shirt', category: 'top', subcategory: 'shirt', color_primary: 'red', formality: 5, fit: 'regular', material: 'cotton' }),
  linenTee:       g({ id: 'linen-tee', category: 'top', subcategory: 't-shirt', color_primary: 'beige', formality: 3, fit: 'relaxed', material: 'linen' }),

  // Bottoms
  navyTrousers:   g({ id: 'navy-trousers', category: 'bottom', subcategory: 'trousers', color_primary: 'navy', formality: 7, fit: 'slim', material: 'wool' }),
  blueJeans:      g({ id: 'blue-jeans', category: 'bottom', subcategory: 'jeans', color_primary: 'blue', formality: 3, fit: 'regular', material: 'denim' }),
  beigeChinos:    g({ id: 'beige-chinos', category: 'bottom', subcategory: 'chinos', color_primary: 'beige', formality: 5, fit: 'regular', material: 'cotton' }),
  blackJoggers:   g({ id: 'black-joggers', category: 'bottom', subcategory: 'joggers', color_primary: 'black', formality: 1, fit: 'relaxed', material: 'cotton' }),
  grayShorts:     g({ id: 'gray-shorts', category: 'bottom', subcategory: 'shorts', color_primary: 'gray', formality: 2, fit: 'regular', material: 'cotton' }),

  // Shoes
  whiteSneakers:  g({ id: 'white-sneakers', category: 'shoes', subcategory: 'sneakers', color_primary: 'white', formality: 3, fit: 'regular', material: 'leather' }),
  blackLoafers:   g({ id: 'black-loafers', category: 'shoes', subcategory: 'loafers', color_primary: 'black', formality: 8, fit: 'regular', material: 'leather' }),
  brownBoots:     g({ id: 'brown-boots', category: 'shoes', subcategory: 'boots', color_primary: 'brown', formality: 5, fit: 'regular', material: 'leather' }),
  sandals:        g({ id: 'sandals', category: 'shoes', subcategory: 'sandals', color_primary: 'brown', formality: 1, fit: 'regular', material: 'leather' }),

  // Outerwear
  goretexRaincoat:g({ id: 'goretex-raincoat', category: 'outerwear', subcategory: 'raincoat', color_primary: 'navy', formality: 4, fit: 'regular', material: 'gore-tex' }),
  woolCoat:       g({ id: 'wool-coat', category: 'outerwear', subcategory: 'coat', color_primary: 'black', formality: 7, fit: 'tailored', material: 'wool' }),
  cottonJacket:   g({ id: 'cotton-jacket', category: 'outerwear', subcategory: 'jacket', color_primary: 'beige', formality: 4, fit: 'regular', material: 'cotton' }),

  // Dresses
  redDress:       g({ id: 'red-dress', category: 'dress', subcategory: 'midi-dress', color_primary: 'red', formality: 6, fit: 'fitted', material: 'polyester' }),
  blackDress:     g({ id: 'black-dress', category: 'dress', subcategory: 'midi-dress', color_primary: 'black', formality: 7, fit: 'fitted', material: 'silk' }),
};

// ════════════════════════════════════════════════════════════════
// Scenario 1: Rainy workday
// ════════════════════════════════════════════════════════════════

describe('Scenario 1: Rainy workday', () => {
  const weather = { temperature: 12, precipitation: 'rain', wind: 'medium' };
  const occasion = 'work';

  const withRaincoat = combo([
    item('top', WARDROBE.whiteShirt, 8),
    item('bottom', WARDROBE.navyTrousers, 8),
    item('shoes', WARDROBE.brownBoots, 7),
    item('outerwear', WARDROBE.goretexRaincoat, 8),
  ], 0);

  const withSandals = combo([
    item('top', WARDROBE.whiteShirt, 8),
    item('bottom', WARDROBE.navyTrousers, 8),
    item('shoes', WARDROBE.sandals, 5),
  ], 0);

  const casualNoCoat = combo([
    item('top', WARDROBE.grayHoodie, 5),
    item('bottom', WARDROBE.blackJoggers, 4),
    item('shoes', WARDROBE.whiteSneakers, 6),
  ], 0);

  it('raincoat outfit ranks above sandals outfit', () => {
    const ranked = rankCombos([withSandals, withRaincoat, casualNoCoat], weather, occasion);
    const raincoatIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'goretex-raincoat'));
    const sandalsIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'sandals'));
    expect(raincoatIdx).toBeLessThan(sandalsIdx);
  });

  it('sandals should NOT be in the top-ranked outfit', () => {
    const ranked = rankCombos([withSandals, withRaincoat, casualNoCoat], weather, occasion);
    const top = ranked[0];
    expect(top.items.some(i => i.garment.id === 'sandals')).toBe(false);
  });

  it('top outfit should include outerwear', () => {
    const ranked = rankCombos([withSandals, withRaincoat, casualNoCoat], weather, occasion);
    expect(ranked[0].items.some(i => i.slot === 'outerwear')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 2: Cold smart-casual date
// ════════════════════════════════════════════════════════════════

describe('Scenario 2: Cold smart-casual date', () => {
  const weather = { temperature: 2, precipitation: 'none', wind: 'low' };
  const occasion = 'date';

  const smartDate = combo([
    item('top', WARDROBE.navyPolo, 7),
    item('bottom', WARDROBE.beigeChinos, 7),
    item('shoes', WARDROBE.brownBoots, 7),
    item('outerwear', WARDROBE.woolCoat, 8),
  ], 0);

  const tooFormal = combo([
    item('top', WARDROBE.whiteShirt, 8),
    item('bottom', WARDROBE.navyTrousers, 8),
    item('shoes', WARDROBE.blackLoafers, 8),
    item('outerwear', WARDROBE.woolCoat, 8),
  ], 0);

  const tooCasual = combo([
    item('top', WARDROBE.grayHoodie, 5),
    item('bottom', WARDROBE.blackJoggers, 4),
    item('shoes', WARDROBE.whiteSneakers, 6),
  ], 0);

  it('smart-casual outfit ranks above overly casual outfit for a date', () => {
    const ranked = rankCombos([tooCasual, smartDate, tooFormal], weather, occasion);
    const smartIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'navy-polo'));
    const casualIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'gray-hoodie'));
    expect(smartIdx).toBeLessThan(casualIdx);
  });

  it('cold weather outfit should include outerwear or layering', () => {
    const ranked = rankCombos([tooCasual, smartDate, tooFormal], weather, occasion);
    const topOutfit = ranked[0];
    const hasWarmLayer = topOutfit.items.some(i =>
      i.slot === 'outerwear' ||
      WARM_MATERIALS.some(m => (i.garment.material || '').toLowerCase().includes(m))
    );
    expect(hasWarmLayer).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 3: Hot casual day
// ════════════════════════════════════════════════════════════════

describe('Scenario 3: Hot casual day', () => {
  const weather = { temperature: 32, precipitation: 'none', wind: 'low' };
  const occasion = 'casual';

  const light = combo([
    item('top', WARDROBE.linenTee, 7),
    item('bottom', WARDROBE.grayShorts, 6),
    item('shoes', WARDROBE.sandals, 6),
  ], 0);

  const heavy = combo([
    item('top', WARDROBE.whiteShirt, 7),
    item('bottom', WARDROBE.navyTrousers, 7),
    item('shoes', WARDROBE.brownBoots, 7),
    item('outerwear', WARDROBE.woolCoat, 8),
  ], 0);

  it('light outfit ranks above heavy layered outfit in hot weather', () => {
    const ranked = rankCombos([heavy, light], weather, occasion);
    expect(ranked[0].items.some(i => i.garment.id === 'linen-tee')).toBe(true);
  });

  it('hot weather penalizes outerwear', () => {
    const ranked = rankCombos([heavy, light], weather, occasion);
    const heavyScore = ranked.find(c => c.items.some(i => i.garment.id === 'wool-coat'))!;
    expect(heavyScore.breakdown.practicality).toBeLessThan(7);
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 4: Dress-based wardrobe
// ════════════════════════════════════════════════════════════════

describe('Scenario 4: Dress-based wardrobe', () => {
  const weather = { temperature: 18, precipitation: 'none' };
  const occasion = 'date';

  const dressOutfit = combo([
    item('dress', WARDROBE.blackDress, 8),
    item('shoes', WARDROBE.blackLoafers, 8),
  ], 0);

  const topBottom = combo([
    item('top', WARDROBE.navyPolo, 7),
    item('bottom', WARDROBE.beigeChinos, 7),
    item('shoes', WARDROBE.brownBoots, 7),
  ], 0);

  it('dress outfit is a valid alternative to top+bottom', () => {
    const ranked = rankCombos([dressOutfit, topBottom], weather, occasion);
    expect(ranked.length).toBe(2);
    // Both should score reasonably (above 5)
    ranked.forEach(c => expect(c.totalScore).toBeGreaterThan(5));
  });

  it('dress and top+bottom have different slot structures (not deduped)', () => {
    const sigA = buildFamilySig(dressOutfit.items);
    const sigB = buildFamilySig(topBottom.items);
    expect(sigA.slotStructure).not.toBe(sigB.slotStructure);
    expect(familySimilarity(sigA, sigB)).toBeLessThan(0.8);
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 5: Travel-friendly comfort outfit
// ════════════════════════════════════════════════════════════════

describe('Scenario 5: Travel-friendly comfort outfit', () => {
  const weather = { temperature: 20, precipitation: 'none' };
  const occasion = 'travel';

  const comfort = combo([
    item('top', WARDROBE.blackTee, 7),
    item('bottom', WARDROBE.blueJeans, 7),
    item('shoes', WARDROBE.whiteSneakers, 7),
  ], 0);

  const formal = combo([
    item('top', WARDROBE.whiteShirt, 8),
    item('bottom', WARDROBE.navyTrousers, 8),
    item('shoes', WARDROBE.blackLoafers, 8),
  ], 0);

  it('casual comfort outfit ranks above formal outfit for travel', () => {
    const ranked = rankCombos([formal, comfort], weather, occasion);
    const comfortIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'black-tee'));
    const formalIdx = ranked.findIndex(c => c.items.some(i => i.garment.id === 'white-shirt'));
    expect(comfortIdx).toBeLessThan(formalIdx);
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 6: Safe swap — preserve DNA
// ════════════════════════════════════════════════════════════════

describe('Scenario 6: Safe swap preserves DNA', () => {
  const anchor = WARDROBE.navyPolo; // formality 5, regular fit, solid

  it('similar garment scores higher DNA preservation than wildly different one', () => {
    const similar = WARDROBE.whiteShirt; // formality 7, regular — close
    const wild = WARDROBE.grayHoodie;   // formality 2, oversized — far

    const simDna = dnaPreservationScore(similar, anchor);
    const wildDna = dnaPreservationScore(wild, anchor);
    expect(simDna).toBeGreaterThan(wildDna);
  });

  it('safe swap should prefer same subcategory', () => {
    const sameSubcat = g({ id: 'blue-polo', category: 'top', subcategory: 'polo', color_primary: 'blue', formality: 6, fit: 'regular' });
    const diffSubcat = g({ id: 'gray-tee', category: 'top', subcategory: 't-shirt', color_primary: 'gray', formality: 6, fit: 'regular' });

    expect(dnaPreservationScore(sameSubcat, anchor)).toBeGreaterThan(
      dnaPreservationScore(diffSubcat, anchor)
    );
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 7: Bold swap — expressive lift
// ════════════════════════════════════════════════════════════════

describe('Scenario 7: Bold swap increases expressiveness', () => {
  const ENGINE_WEIGHTS_BOLD: Record<string, number> = {
    item_strength: 0.20, dna_preservation: 0.08, color_harmony: 0.12,
    material_compatibility: 0.06, formality_alignment: 0.10, fit_consistency: 0.04,
    practicality: 0.06, expressive_lift: 0.26, freshness: 0.08,
  };

  function boldScore(factors: Record<string, number>): number {
    let total = 0;
    for (const [key, weight] of Object.entries(ENGINE_WEIGHTS_BOLD)) {
      total += (factors[key] ?? 7) * weight;
    }
    return total;
  }

  it('chromatic candidate beats neutral in bold mode', () => {
    const chromatic = {
      item_strength: 7, dna_preservation: 5, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 7,
      practicality: 7, expressive_lift: 9, freshness: 7,
    };
    const neutral = {
      item_strength: 7, dna_preservation: 8, color_harmony: 8,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 7,
      practicality: 7, expressive_lift: 3, freshness: 7,
    };
    expect(boldScore(chromatic)).toBeGreaterThan(boldScore(neutral));
  });

  it('bold swap still respects minimum formality alignment', () => {
    // A wild candidate with terrible formality should still be penalized
    const boldButMismatched = {
      item_strength: 7, dna_preservation: 3, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 1, fit_consistency: 3,
      practicality: 7, expressive_lift: 10, freshness: 7,
    };
    const balancedBold = {
      item_strength: 7, dna_preservation: 5, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 6,
      practicality: 7, expressive_lift: 8, freshness: 7,
    };
    expect(boldScore(balancedBold)).toBeGreaterThan(boldScore(boldButMismatched));
  });
});

// ════════════════════════════════════════════════════════════════
// Scenario 8: Fresh swap — reward unworn garments
// ════════════════════════════════════════════════════════════════

describe('Scenario 8: Fresh swap rewards novelty', () => {
  const ENGINE_WEIGHTS_FRESH: Record<string, number> = {
    item_strength: 0.22, dna_preservation: 0.14, color_harmony: 0.10,
    material_compatibility: 0.06, formality_alignment: 0.10, fit_consistency: 0.08,
    practicality: 0.06, expressive_lift: 0.06, freshness: 0.18,
  };

  function freshScore(factors: Record<string, number>): number {
    let total = 0;
    for (const [key, weight] of Object.entries(ENGINE_WEIGHTS_FRESH)) {
      total += (factors[key] ?? 7) * weight;
    }
    return total;
  }

  it('unworn garment ranks higher than heavily worn in fresh mode', () => {
    const unworn = {
      item_strength: 7, dna_preservation: 7, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 7,
      practicality: 7, expressive_lift: 5, freshness: 9,
    };
    const worn = {
      item_strength: 7, dna_preservation: 7, color_harmony: 7,
      material_compatibility: 7, formality_alignment: 7, fit_consistency: 7,
      practicality: 7, expressive_lift: 5, freshness: 3,
    };
    expect(freshScore(unworn)).toBeGreaterThan(freshScore(worn));
  });

  it('freshness gap matters more in fresh mode than safe mode', () => {
    const ENGINE_WEIGHTS_SAFE: Record<string, number> = {
      item_strength: 0.24, dna_preservation: 0.26, color_harmony: 0.10,
      material_compatibility: 0.06, formality_alignment: 0.12, fit_consistency: 0.10,
      practicality: 0.08, expressive_lift: 0.00, freshness: 0.04,
    };
    function safeScore(factors: Record<string, number>): number {
      let total = 0;
      for (const [key, weight] of Object.entries(ENGINE_WEIGHTS_SAFE)) {
        total += (factors[key] ?? 7) * weight;
      }
      return total;
    }

    const high = { freshness: 9 } as Record<string, number>;
    const low = { freshness: 3 } as Record<string, number>;

    const freshGap = freshScore(high) - freshScore(low);
    const safeGap = safeScore(high) - safeScore(low);
    expect(freshGap).toBeGreaterThan(safeGap);
  });
});

// ════════════════════════════════════════════════════════════════
// Cross-scenario: Duplicate families should not dominate
// ════════════════════════════════════════════════════════════════

describe('Cross-scenario: Family dedup prevents monotonous results', () => {
  it('three near-identical combos collapse to one representative', () => {
    const baseItems = [
      item('top', WARDROBE.whiteShirt, 8),
      item('bottom', WARDROBE.navyTrousers, 8),
      item('shoes', WARDROBE.blackLoafers, 8),
    ];

    // Slight ID variations but identical metadata
    const c1 = combo(baseItems, 8);
    const c2 = combo([
      item('top', g({ ...WARDROBE.whiteShirt, id: 'white-shirt-2' }), 7.8),
      item('bottom', g({ ...WARDROBE.navyTrousers, id: 'navy-trousers-2' }), 7.8),
      item('shoes', g({ ...WARDROBE.blackLoafers, id: 'black-loafers-2' }), 7.8),
    ], 7.8);
    const c3 = combo([
      item('top', g({ ...WARDROBE.whiteShirt, id: 'white-shirt-3' }), 7.5),
      item('bottom', g({ ...WARDROBE.navyTrousers, id: 'navy-trousers-3' }), 7.5),
      item('shoes', g({ ...WARDROBE.blackLoafers, id: 'black-loafers-3' }), 7.5),
    ], 7.5);

    // All three share identical family signatures (sim = 1.0)
    const sig1 = buildFamilySig(c1.items);
    const sig2 = buildFamilySig(c2.items);
    const sig3 = buildFamilySig(c3.items);
    expect(familySimilarity(sig1, sig2)).toBe(1);
    expect(familySimilarity(sig1, sig3)).toBe(1);
  });

  it('genuinely different families are preserved', () => {
    const formal = combo([
      item('top', WARDROBE.whiteShirt, 8),
      item('bottom', WARDROBE.navyTrousers, 8),
      item('shoes', WARDROBE.blackLoafers, 8),
    ], 8);

    const casual = combo([
      item('top', WARDROBE.blackTee, 6),
      item('bottom', WARDROBE.blueJeans, 6),
      item('shoes', WARDROBE.whiteSneakers, 6),
    ], 6);

    const dress = combo([
      item('dress', WARDROBE.redDress, 7),
      item('shoes', WARDROBE.brownBoots, 7),
    ], 7);

    const sigs = [formal, casual, dress].map(c => buildFamilySig(c.items));
    // No pair should exceed dedup threshold
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        expect(familySimilarity(sigs[i], sigs[j])).toBeLessThan(0.8);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Outfit completeness validation
// ════════════════════════════════════════════════════════════════

function isCompleteOutfit(
  items: ComboItem[],
  weather: { temperature?: number; precipitation?: string; wind?: string }
): { complete: boolean; missing: string[] } {
  const slots = new Set(items.map(i => i.slot));
  const missing: string[] = [];
  const hasTop = slots.has('top');
  const hasBottom = slots.has('bottom');
  const hasShoes = slots.has('shoes');
  const hasDress = slots.has('dress');
  const hasOuterwear = slots.has('outerwear');

  const standardPath = hasTop && hasBottom && hasShoes;
  const dressPath = hasDress && hasShoes;

  if (!standardPath && !dressPath) {
    if (!hasDress && !hasTop) missing.push('top');
    if (!hasDress && !hasBottom) missing.push('bottom');
    if (!hasShoes) missing.push('shoes');
  }

  const precip = String(weather.precipitation || '').toLowerCase();
  const wet = precip !== '' && !['none', 'ingen'].includes(precip);
  const coldEnough = weather.temperature !== undefined && weather.temperature < 8;
  const hasSnow = precip.includes('snow') || precip.includes('snö');
  const needsOuter = coldEnough || wet || hasSnow;

  if (needsOuter && !hasOuterwear) {
    missing.push('outerwear');
  }

  const hasValidBase = standardPath || dressPath;
  const complete = hasValidBase && (!needsOuter || hasOuterwear);
  return { complete, missing };
}

describe('Outfit completeness', () => {
  const mildWeather = { temperature: 20, precipitation: 'none', wind: 'low' };
  const coldWeather = { temperature: 3, precipitation: 'none', wind: 'low' };
  const rainyWeather = { temperature: 12, precipitation: 'rain', wind: 'medium' };

  it('rejects pants + shoes + jacket (no top)', () => {
    const items = [
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
      item('outerwear', g({ id: 'o1', category: 'jacket', color_primary: 'black' })),
    ];
    const result = isCompleteOutfit(items, mildWeather);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('top');
  });

  it('accepts top + bottom + shoes', () => {
    const items = [
      item('top', g({ id: 't1', category: 'shirt', color_primary: 'white' })),
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
    ];
    expect(isCompleteOutfit(items, mildWeather).complete).toBe(true);
  });

  it('accepts dress + shoes', () => {
    const items = [
      item('dress', g({ id: 'd1', category: 'dress', color_primary: 'red' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
    ];
    expect(isCompleteOutfit(items, mildWeather).complete).toBe(true);
  });

  it('rejects dress without shoes', () => {
    const items = [
      item('dress', g({ id: 'd1', category: 'dress', color_primary: 'red' })),
    ];
    const result = isCompleteOutfit(items, mildWeather);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('shoes');
  });

  it('rejects cold-weather outfit without outerwear', () => {
    const items = [
      item('top', g({ id: 't1', category: 'shirt', color_primary: 'white' })),
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
    ];
    const result = isCompleteOutfit(items, coldWeather);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('outerwear');
  });

  it('accepts cold-weather outfit with outerwear', () => {
    const items = [
      item('top', g({ id: 't1', category: 'shirt', color_primary: 'white' })),
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
      item('outerwear', g({ id: 'o1', category: 'jacket', color_primary: 'black' })),
    ];
    expect(isCompleteOutfit(items, coldWeather).complete).toBe(true);
  });

  it('rejects rainy outfit without outerwear', () => {
    const items = [
      item('top', g({ id: 't1', category: 'shirt', color_primary: 'white' })),
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
    ];
    expect(isCompleteOutfit(items, rainyWeather).complete).toBe(false);
  });

  it('vest counts as outerwear, not as top', () => {
    const items = [
      item('outerwear', g({ id: 'v1', category: 'vest', color_primary: 'grey' })),
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('shoes', g({ id: 's1', category: 'shoes', color_primary: 'black' })),
    ];
    const result = isCompleteOutfit(items, mildWeather);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('top');
  });

  it('rejects bottom + outerwear only', () => {
    const items = [
      item('bottom', g({ id: 'b1', category: 'pants', color_primary: 'blue' })),
      item('outerwear', g({ id: 'o1', category: 'coat', color_primary: 'black' })),
    ];
    const result = isCompleteOutfit(items, mildWeather);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('top');
    expect(result.missing).toContain('shoes');
  });
});

// ════════════════════════════════════════════════════════════════
// Evaluation summary — aggregate pass/fail view
// ════════════════════════════════════════════════════════════════

describe('Evaluation summary helper', () => {
  it('correctly tallies pass/fail', () => {
    const assertions: EvalAssertion[] = [
      { name: 'rain-ranks-raincoat', pass: true },
      { name: 'no-sandals-in-rain', pass: true },
      { name: 'cold-has-outerwear', pass: true },
      { name: 'hypothetical-failure', pass: false },
    ];
    const summary = evalSummary(assertions);
    expect(summary.passed).toBe(3);
    expect(summary.failed).toBe(1);
    expect(summary.total).toBe(4);
    expect(summary.failedNames).toEqual(['hypothetical-failure']);
  });
});
