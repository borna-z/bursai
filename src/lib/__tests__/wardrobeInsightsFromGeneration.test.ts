/**
 * Tests for generation-driven wardrobe insight derivation.
 * Mirrors helpers from burs_style_engine: aggregateFailurePatterns,
 * deriveWardrobeInsightsFromGeneration.
 */
import { describe, it, expect } from 'vitest';

// ── Mirrored types ──

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface WeatherInput {
  temperature?: number;
  precipitation?: string;
  wind?: string;
}

interface GenerationFailureSignal {
  occasion: string;
  weather: WeatherInput;
  gaps: string[];
  confidence_level: ConfidenceLevel;
  slotWeaknesses: string[];
  formalityMismatch: boolean;
}

interface WardrobeInsight {
  type: 'weather_gap' | 'formality_gap' | 'category_imbalance' | 'slot_weakness' | 'versatility';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
  related_occasions: string[];
}

// ── Mirrored helpers ──

function aggregateFailurePatterns(signals: GenerationFailureSignal[]) {
  const weatherFailures = signals.filter(s => {
    const precip = (s.weather.precipitation || '').toLowerCase();
    return (precip.includes('rain') || precip.includes('snow') || precip.includes('regn') || precip.includes('snö')) &&
      s.gaps.some(g => g.includes('rain') || g.includes('outerwear') || g.includes('waterproof'));
  }).length;

  const formalityFailures = signals.filter(s => s.formalityMismatch).length;

  const slotFailureCounts: Record<string, number> = {};
  for (const s of signals) {
    for (const slot of s.slotWeaknesses) {
      slotFailureCounts[slot] = (slotFailureCounts[slot] || 0) + 1;
    }
  }

  const weakOccasions: Record<string, number> = {};
  for (const s of signals) {
    if (s.confidence_level !== 'high') {
      const occ = s.occasion.toLowerCase();
      weakOccasions[occ] = (weakOccasions[occ] || 0) + 1;
    }
  }

  const gapFrequency: Record<string, number> = {};
  for (const s of signals) {
    for (const gap of s.gaps) {
      gapFrequency[gap] = (gapFrequency[gap] || 0) + 1;
    }
  }

  return { weatherFailures, formalityFailures, slotFailureCounts, weakOccasions, gapFrequency };
}

function deriveWardrobeInsightsFromGeneration(signals: GenerationFailureSignal[]): WardrobeInsight[] {
  if (signals.length === 0) return [];

  const patterns = aggregateFailurePatterns(signals);
  const insights: WardrobeInsight[] = [];

  if (patterns.weatherFailures >= 2) {
    const rainGaps = signals.filter(s => s.gaps.some(g => g.includes('rain-friendly shoes')));
    const outerwearGaps = signals.filter(s => s.gaps.some(g => g.includes('outerwear')));
    if (rainGaps.length >= 2) {
      insights.push({
        type: 'weather_gap', severity: 'high',
        message: 'Your wardrobe struggles in rainy weather — no rain-friendly smart shoes found across multiple requests.',
        suggestion: 'Consider adding waterproof boots or rain-ready loafers.',
        related_occasions: [...new Set(rainGaps.map(s => s.occasion))],
      });
    }
    if (outerwearGaps.length >= 2) {
      insights.push({
        type: 'weather_gap', severity: 'high',
        message: 'Weak outerwear coverage for cold or rainy days — the engine had to compromise on practicality.',
        suggestion: 'A waterproof jacket or insulated coat would unlock better cold/wet weather outfits.',
        related_occasions: [...new Set(outerwearGaps.map(s => s.occasion))],
      });
    }
  }

  if (patterns.formalityFailures >= 2) {
    const formalOccasions = [...new Set(signals.filter(s => s.formalityMismatch).map(s => s.occasion))];
    insights.push({
      type: 'formality_gap', severity: 'high',
      message: 'Not enough elevated options for date or work occasions — the engine repeatedly lacks refined tops or bottoms.',
      suggestion: 'Adding a structured blazer, tailored trousers, or a dress shirt would significantly improve formal outfit options.',
      related_occasions: formalOccasions,
    });
  }

  for (const [slot, count] of Object.entries(patterns.slotFailureCounts)) {
    if (count >= 2) {
      const severity = count >= 3 ? 'high' as const : 'medium' as const;
      const slotLabel = slot === 'outerwear' ? 'outerwear' : slot === 'shoes' ? 'shoes' : `${slot} pieces`;
      insights.push({
        type: 'slot_weakness', severity,
        message: `Too few ${slotLabel} in your wardrobe — this slot limited outfit variety in ${count} generation attempts.`,
        suggestion: `Adding 2-3 more ${slotLabel} would meaningfully expand your outfit combinations.`,
        related_occasions: [...new Set(signals.filter(s => s.slotWeaknesses.includes(slot)).map(s => s.occasion))],
      });
    }
  }

  const casualTopGaps = signals.filter(s => s.gaps.some(g => g.includes('formal top') || g.includes('formal bottom')));
  if (casualTopGaps.length >= 2 && !insights.some(i => i.type === 'formality_gap')) {
    insights.push({
      type: 'category_imbalance', severity: 'medium',
      message: 'Your wardrobe leans casual — too many relaxed pieces and not enough refined bottoms or structured tops.',
      suggestion: 'Balance with a pair of tailored chinos or slim trousers.',
      related_occasions: [...new Set(casualTopGaps.map(s => s.occasion))],
    });
  }

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return insights.slice(0, 5);
}

// ── Test helpers ──

function makeSignal(overrides: Partial<GenerationFailureSignal>): GenerationFailureSignal {
  return {
    occasion: 'casual',
    weather: {},
    gaps: [],
    confidence_level: 'medium',
    slotWeaknesses: [],
    formalityMismatch: false,
    ...overrides,
  };
}

// ── Tests ──

describe('Repeated rainy-day failures produce weather-specific insight', () => {
  it('produces rain shoe insight from 2+ rain failures with shoe gaps', () => {
    const signals = [
      makeSignal({
        occasion: 'work',
        weather: { temperature: 10, precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes', 'no rain-friendly outerwear available'],
        confidence_level: 'low',
      }),
      makeSignal({
        occasion: 'casual',
        weather: { temperature: 8, precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes'],
        confidence_level: 'medium',
      }),
      makeSignal({
        occasion: 'date',
        weather: { temperature: 15, precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes', 'no rain-friendly outerwear available'],
        confidence_level: 'low',
      }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    expect(insights.length).toBeGreaterThanOrEqual(1);

    const rainShoeInsight = insights.find(i =>
      i.type === 'weather_gap' && i.message.includes('rain')
    );
    expect(rainShoeInsight).toBeDefined();
    expect(rainShoeInsight!.severity).toBe('high');
    expect(rainShoeInsight!.related_occasions.length).toBeGreaterThanOrEqual(2);
  });

  it('produces outerwear insight from 2+ rain failures with outerwear gaps', () => {
    const signals = [
      makeSignal({
        occasion: 'work',
        weather: { temperature: 5, precipitation: 'rain' },
        gaps: ['no rain-friendly outerwear available', 'missing outerwear for cold or wet weather'],
      }),
      makeSignal({
        occasion: 'casual',
        weather: { temperature: 3, precipitation: 'snow' },
        gaps: ['no rain-friendly outerwear available', 'missing outerwear for cold or wet weather'],
      }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    const outerwearInsight = insights.find(i =>
      i.type === 'weather_gap' && i.message.includes('outerwear')
    );
    expect(outerwearInsight).toBeDefined();
    expect(outerwearInsight!.severity).toBe('high');
  });

  it('does NOT produce weather insight from a single rainy-day failure', () => {
    const signals = [
      makeSignal({
        occasion: 'work',
        weather: { temperature: 10, precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes'],
        confidence_level: 'low',
      }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    const weatherInsights = insights.filter(i => i.type === 'weather_gap');
    expect(weatherInsights.length).toBe(0);
  });
});

describe('Repeated work-formality failures produce smarter wardrobe gap insight', () => {
  it('produces formality gap insight from 2+ formal occasion failures', () => {
    const signals = [
      makeSignal({
        occasion: 'work',
        weather: {},
        gaps: ['weak formal top options for this occasion', 'weak formal bottom options for this occasion'],
        confidence_level: 'medium',
        formalityMismatch: true,
      }),
      makeSignal({
        occasion: 'interview',
        weather: {},
        gaps: ['weak formal top options for this occasion'],
        confidence_level: 'low',
        formalityMismatch: true,
      }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    const formalityInsight = insights.find(i => i.type === 'formality_gap');
    expect(formalityInsight).toBeDefined();
    expect(formalityInsight!.severity).toBe('high');
    expect(formalityInsight!.related_occasions).toContain('work');
    expect(formalityInsight!.related_occasions).toContain('interview');
    expect(formalityInsight!.suggestion).toMatch(/blazer|trousers|shirt/i);
  });

  it('does NOT produce formality insight from a single failure', () => {
    const signals = [
      makeSignal({
        occasion: 'work',
        gaps: ['weak formal top options for this occasion'],
        formalityMismatch: true,
      }),
    ];
    const insights = deriveWardrobeInsightsFromGeneration(signals);
    expect(insights.filter(i => i.type === 'formality_gap').length).toBe(0);
  });
});

describe('Slot weakness insights from repeated failures', () => {
  it('produces slot weakness insight when same slot fails 2+ times', () => {
    const signals = [
      makeSignal({ occasion: 'casual', slotWeaknesses: ['shoes', 'outerwear'] }),
      makeSignal({ occasion: 'work', slotWeaknesses: ['shoes'] }),
      makeSignal({ occasion: 'date', slotWeaknesses: ['shoes'] }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    const shoesInsight = insights.find(i =>
      i.type === 'slot_weakness' && i.message.includes('shoes')
    );
    expect(shoesInsight).toBeDefined();
    expect(shoesInsight!.related_occasions.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Aggregate failure patterns', () => {
  it('correctly counts weather failures', () => {
    const signals = [
      makeSignal({ weather: { precipitation: 'rain' }, gaps: ['missing rain-friendly shoes'] }),
      makeSignal({ weather: { precipitation: 'rain' }, gaps: ['no rain-friendly outerwear available'] }),
      makeSignal({ weather: {}, gaps: [] }),
    ];
    const patterns = aggregateFailurePatterns(signals);
    expect(patterns.weatherFailures).toBe(2);
  });

  it('correctly counts formality failures', () => {
    const signals = [
      makeSignal({ formalityMismatch: true }),
      makeSignal({ formalityMismatch: true }),
      makeSignal({ formalityMismatch: false }),
    ];
    const patterns = aggregateFailurePatterns(signals);
    expect(patterns.formalityFailures).toBe(2);
  });

  it('tracks gap frequency', () => {
    const signals = [
      makeSignal({ gaps: ['missing rain-friendly shoes', 'small wardrobe limits outfit variety'] }),
      makeSignal({ gaps: ['missing rain-friendly shoes'] }),
    ];
    const patterns = aggregateFailurePatterns(signals);
    expect(patterns.gapFrequency['missing rain-friendly shoes']).toBe(2);
    expect(patterns.gapFrequency['small wardrobe limits outfit variety']).toBe(1);
  });
});

describe('Empty signals produce no insights', () => {
  it('returns empty array for no signals', () => {
    expect(deriveWardrobeInsightsFromGeneration([])).toEqual([]);
  });

  it('returns empty array for signals with no gaps', () => {
    const signals = [
      makeSignal({ confidence_level: 'high' }),
      makeSignal({ confidence_level: 'high' }),
    ];
    expect(deriveWardrobeInsightsFromGeneration(signals)).toEqual([]);
  });
});

describe('Insights are sorted by severity', () => {
  it('high severity insights appear first', () => {
    const signals = [
      makeSignal({ occasion: 'work', slotWeaknesses: ['shoes'] }),
      makeSignal({ occasion: 'date', slotWeaknesses: ['shoes'] }),
      makeSignal({
        occasion: 'work',
        weather: { precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes'],
        formalityMismatch: true,
      }),
      makeSignal({
        occasion: 'interview',
        weather: { precipitation: 'rain' },
        gaps: ['missing rain-friendly shoes'],
        formalityMismatch: true,
      }),
    ];

    const insights = deriveWardrobeInsightsFromGeneration(signals);
    if (insights.length >= 2) {
      const severities = insights.map(i => i.severity);
      const highIdx = severities.indexOf('high');
      const mediumIdx = severities.indexOf('medium');
      if (highIdx !== -1 && mediumIdx !== -1) {
        expect(highIdx).toBeLessThan(mediumIdx);
      }
    }
  });
});
