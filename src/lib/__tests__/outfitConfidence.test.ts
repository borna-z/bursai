/**
 * Tests for outfit confidence scoring and wardrobe gap detection.
 * Mirrors helpers from burs_style_engine.
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

interface ScoredGarment {
  garment: GarmentRow;
  score: number;
  breakdown: Record<string, number>;
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

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface ConfidenceResult {
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  limitation_note: string | null;
}

interface WeatherInput {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

const WATERPROOF_MATERIALS = ['gore-tex', 'polyester', 'nylon', 'softshell', 'regn', 'rain'];

// ── Mirrored helpers ──

function computeConfidence(
  combo: ScoredCombo,
  candidateCount: number,
  slotCandidates: Record<string, ScoredGarment[]>,
  weather: WeatherInput,
  _occasion: string
): ConfidenceResult {
  const b = combo.breakdown;
  let score = 0;
  const contextFit = ((b.occasion_fit || 7) + (b.style_intent || 7)) / 2;
  score += contextFit * 0.30;
  score += (b.practicality || 7) * 0.25;
  score += (b.formality || b.formalityConsistency || 7) * 0.15;
  const poolDepth = Math.min(candidateCount, 20);
  score += ((poolDepth / 20) * 10) * 0.15;
  const requiredSlots = ['top', 'bottom', 'shoes'];
  let coverageScore = 10;
  for (const slot of requiredSlots) {
    const count = (slotCandidates[slot] || []).length;
    if (count === 0) coverageScore -= 4;
    else if (count === 1) coverageScore -= 2;
    else if (count <= 3) coverageScore -= 0.5;
  }
  score += Math.max(0, coverageScore) * 0.15;
  const final = Math.max(0, Math.min(10, score));
  const level: ConfidenceLevel = final >= 7 ? 'high' : final >= 4.5 ? 'medium' : 'low';
  return { confidence_score: Math.round(final * 10) / 10, confidence_level: level, limitation_note: null };
}

function detectWardrobeGapForRequest(
  slotCandidates: Record<string, ScoredGarment[]>,
  weather: WeatherInput,
  occasion: string
): string[] {
  const gaps: string[] = [];
  const temp = weather.temperature;
  const precip = (weather.precipitation || '').toLowerCase();
  const isRainy = precip.includes('rain') || precip.includes('regn');
  const isSnowy = precip.includes('snow') || precip.includes('snö');
  const isCold = temp !== undefined && temp < 10;
  const isVeryCold = temp !== undefined && temp < 0;
  const outerwearCount = (slotCandidates['outerwear'] || []).length;
  if ((isCold || isRainy || isSnowy) && outerwearCount === 0) gaps.push('missing outerwear for cold or wet weather');
  if (isRainy || isSnowy) {
    const hasWaterproof = (slotCandidates['outerwear'] || []).some(g => {
      const mat = (g.garment.material || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w));
    });
    if (!hasWaterproof) gaps.push('no rain-friendly outerwear available');
    const hasWaterproofShoes = (slotCandidates['shoes'] || []).some(g => {
      const mat = (g.garment.material || '').toLowerCase();
      const title = (g.garment.title || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w)) || title.includes('boot') || title.includes('stövel');
    });
    if (!hasWaterproofShoes) gaps.push('missing rain-friendly shoes');
  }
  if (isVeryCold && (slotCandidates['top'] || []).length < 2 && outerwearCount === 0) {
    gaps.push('not enough layering pieces for current weather');
  }
  const formalOccasions = ['work', 'jobb', 'interview', 'intervju', 'formal', 'formell', 'business'];
  if (formalOccasions.includes(occasion.toLowerCase())) {
    if ((slotCandidates['top'] || []).filter(g => (g.garment.formality ?? 5) >= 6).length === 0) {
      gaps.push('weak formal top options for this occasion');
    }
    if ((slotCandidates['bottom'] || []).filter(g => (g.garment.formality ?? 5) >= 6).length === 0) {
      gaps.push('weak formal bottom options for this occasion');
    }
  }
  if (Object.values(slotCandidates).reduce((sum, arr) => sum + arr.length, 0) < 6) {
    gaps.push('small wardrobe limits outfit variety');
  }
  return gaps;
}

function computeSwapConfidence(
  candidates: ScoredGarment[],
  slot: string,
  weather: WeatherInput
): ConfidenceResult {
  let score = 7;
  if (candidates.length === 0) score = 1;
  else if (candidates.length === 1) score -= 2;
  else if (candidates.length <= 3) score -= 1;
  if (candidates.length > 0) {
    const bestScore = candidates[0].score;
    if (bestScore < 4) score -= 2;
    else if (bestScore < 5.5) score -= 1;
    else if (bestScore >= 7.5) score += 1;
  }
  const precip = (weather.precipitation || '').toLowerCase();
  const isWet = precip.includes('rain') || precip.includes('regn') || precip.includes('snow');
  if (isWet && (slot === 'shoes' || slot === 'outerwear')) {
    const hasWeatherReady = candidates.some(c => {
      const mat = (c.garment.material || '').toLowerCase();
      return WATERPROOF_MATERIALS.some(w => mat.includes(w));
    });
    if (!hasWeatherReady) score -= 1.5;
  }
  const final = Math.max(0, Math.min(10, score));
  const level: ConfidenceLevel = final >= 7 ? 'high' : final >= 4.5 ? 'medium' : 'low';
  let note: string | null = null;
  if (candidates.length === 0) note = 'no alternatives available for this slot';
  else if (level === 'low') note = 'limited strong alternatives available';
  return { confidence_score: Math.round(final * 10) / 10, confidence_level: level, limitation_note: note };
}

// ── Test helpers ──

function makeGarment(overrides: Partial<GarmentRow> & { id: string; category: string; color_primary: string }): GarmentRow {
  return {
    title: overrides.id, subcategory: null, color_secondary: null, pattern: null,
    material: null, fit: null, formality: null, season_tags: null,
    wear_count: 0, last_worn_at: null, image_path: 'test.jpg', ...overrides,
  };
}

function makeScored(garment: GarmentRow, score = 7): ScoredGarment {
  return { garment, score, breakdown: {} };
}

function makeCombo(items: ComboItem[], score: number, breakdown: Record<string, number> = {}): ScoredCombo {
  return { items, totalScore: score, breakdown: { overall: score, practicality: 7, occasion_fit: 7, style_intent: 7, formality: 7, ...breakdown } };
}

function makeItem(slot: string, g: GarmentRow): ComboItem {
  return { slot, garment: g, baseScore: 7, baseBreakdown: {} };
}

// ── Tests ──

describe('Low-candidate wardrobes produce lower confidence', () => {
  it('empty slots reduce confidence', () => {
    const combo = makeCombo([
      makeItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'black' })),
      makeItem('bottom', makeGarment({ id: 'b1', category: 'bottom', color_primary: 'navy' })),
      makeItem('shoes', makeGarment({ id: 's1', category: 'shoes', color_primary: 'white' })),
    ], 7);

    const rich = computeConfidence(combo, 15, {
      top: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `t${i}`, category: 'top', color_primary: 'black' }))),
      bottom: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `b${i}`, category: 'bottom', color_primary: 'navy' }))),
      shoes: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `s${i}`, category: 'shoes', color_primary: 'white' }))),
    }, {}, 'casual');

    const thin = computeConfidence(combo, 3, {
      top: [makeScored(makeGarment({ id: 't0', category: 'top', color_primary: 'black' }))],
      bottom: [makeScored(makeGarment({ id: 'b0', category: 'bottom', color_primary: 'navy' }))],
      shoes: [makeScored(makeGarment({ id: 's0', category: 'shoes', color_primary: 'white' }))],
    }, {}, 'casual');

    expect(rich.confidence_score).toBeGreaterThan(thin.confidence_score);
  });

  it('very thin wardrobe gets low confidence', () => {
    const combo = makeCombo([
      makeItem('top', makeGarment({ id: 't1', category: 'top', color_primary: 'black' })),
    ], 4, { practicality: 4, occasion_fit: 4, style_intent: 4, formality: 4 });

    const result = computeConfidence(combo, 1, {
      top: [makeScored(makeGarment({ id: 't0', category: 'top', color_primary: 'black' }))],
    }, {}, 'casual');

    expect(result.confidence_level).toBe('low');
  });
});

describe('Poor weather compatibility lowers confidence', () => {
  it('low practicality score reduces confidence', () => {
    const goodWeather = makeCombo([], 7, { practicality: 9, occasion_fit: 7, style_intent: 7, formality: 7 });
    const badWeather = makeCombo([], 7, { practicality: 3, occasion_fit: 7, style_intent: 7, formality: 7 });

    const slots = {
      top: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `t${i}`, category: 'top', color_primary: 'black' }))),
      bottom: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `b${i}`, category: 'bottom', color_primary: 'navy' }))),
      shoes: Array.from({ length: 5 }, (_, i) => makeScored(makeGarment({ id: `s${i}`, category: 'shoes', color_primary: 'white' }))),
    };

    const good = computeConfidence(goodWeather, 10, slots, {}, 'casual');
    const bad = computeConfidence(badWeather, 10, slots, {}, 'casual');

    expect(good.confidence_score).toBeGreaterThan(bad.confidence_score);
  });
});

describe('Wardrobe gaps generate limitation notes', () => {
  it('detects missing rain-friendly shoes', () => {
    const slots: Record<string, ScoredGarment[]> = {
      top: [makeScored(makeGarment({ id: 't1', category: 'top', color_primary: 'white' }))],
      bottom: [makeScored(makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue' }))],
      shoes: [makeScored(makeGarment({ id: 's1', category: 'shoes', color_primary: 'white', material: 'canvas', title: 'sneakers' }))],
    };

    const gaps = detectWardrobeGapForRequest(slots, { temperature: 12, precipitation: 'rain' }, 'casual');
    expect(gaps.some(g => g.includes('rain-friendly shoes'))).toBe(true);
  });

  it('detects weak formal options', () => {
    const slots: Record<string, ScoredGarment[]> = {
      top: [makeScored(makeGarment({ id: 't1', category: 'top', color_primary: 'white', formality: 3 }))],
      bottom: [makeScored(makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue', formality: 3 }))],
      shoes: [makeScored(makeGarment({ id: 's1', category: 'shoes', color_primary: 'black', formality: 4 }))],
    };

    const gaps = detectWardrobeGapForRequest(slots, {}, 'work');
    expect(gaps.some(g => g.includes('formal'))).toBe(true);
  });

  it('detects missing outerwear for cold weather', () => {
    const slots: Record<string, ScoredGarment[]> = {
      top: [makeScored(makeGarment({ id: 't1', category: 'top', color_primary: 'white' }))],
      bottom: [makeScored(makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue' }))],
      shoes: [makeScored(makeGarment({ id: 's1', category: 'shoes', color_primary: 'black' }))],
    };

    const gaps = detectWardrobeGapForRequest(slots, { temperature: 2 }, 'casual');
    expect(gaps.some(g => g.includes('outerwear'))).toBe(true);
  });

  it('detects small wardrobe', () => {
    const slots: Record<string, ScoredGarment[]> = {
      top: [makeScored(makeGarment({ id: 't1', category: 'top', color_primary: 'white' }))],
      bottom: [makeScored(makeGarment({ id: 'b1', category: 'bottom', color_primary: 'blue' }))],
      shoes: [makeScored(makeGarment({ id: 's1', category: 'shoes', color_primary: 'black' }))],
    };

    const gaps = detectWardrobeGapForRequest(slots, {}, 'casual');
    expect(gaps.some(g => g.includes('small wardrobe'))).toBe(true);
  });

  it('no gaps for well-stocked wardrobe in good weather', () => {
    const slots: Record<string, ScoredGarment[]> = {
      top: Array.from({ length: 4 }, (_, i) => makeScored(makeGarment({ id: `t${i}`, category: 'top', color_primary: 'white' }))),
      bottom: Array.from({ length: 3 }, (_, i) => makeScored(makeGarment({ id: `b${i}`, category: 'bottom', color_primary: 'navy' }))),
      shoes: Array.from({ length: 3 }, (_, i) => makeScored(makeGarment({ id: `s${i}`, category: 'shoes', color_primary: 'black' }))),
    };

    const gaps = detectWardrobeGapForRequest(slots, { temperature: 20, precipitation: 'none' }, 'casual');
    expect(gaps.length).toBe(0);
  });
});

describe('Swap confidence', () => {
  it('zero candidates produces low confidence', () => {
    const result = computeSwapConfidence([], 'top', {});
    expect(result.confidence_level).toBe('low');
    expect(result.limitation_note).toBeTruthy();
  });

  it('many strong candidates produces high confidence', () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      makeScored(makeGarment({ id: `g${i}`, category: 'top', color_primary: 'black' }), 8)
    );
    const result = computeSwapConfidence(candidates, 'top', {});
    expect(result.confidence_level).toBe('high');
  });

  it('wet weather without waterproof shoes lowers confidence', () => {
    const candidates = [
      makeScored(makeGarment({ id: 's1', category: 'shoes', color_primary: 'white', material: 'canvas' }), 7),
    ];
    const withRain = computeSwapConfidence(candidates, 'shoes', { precipitation: 'rain' });
    const noRain = computeSwapConfidence(candidates, 'shoes', { precipitation: 'none' });
    expect(noRain.confidence_score).toBeGreaterThan(withRain.confidence_score);
  });
});
