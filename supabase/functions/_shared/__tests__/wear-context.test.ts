import { describe, expect, it } from 'vitest';

import { buildWearContext } from '../wear-context';
import type {
  FeedbackSignal,
  GarmentRow,
  WearLog,
} from '../outfit-scoring';

function garment(overrides: Partial<GarmentRow> = {}): GarmentRow {
  return {
    id: overrides.id || 'g',
    title: overrides.title || 'piece',
    category: overrides.category || 'top',
    subcategory: overrides.subcategory ?? 'shirt',
    color_primary: overrides.color_primary || 'navy',
    color_secondary: null,
    pattern: 'solid',
    material: overrides.material || 'cotton',
    fit: overrides.fit || 'regular',
    formality: overrides.formality ?? 5,
    season_tags: overrides.season_tags ?? [],
    wear_count: overrides.wear_count ?? 0,
    last_worn_at: null,
    image_path: '',
    created_at: null,
    enrichment_status: null,
    ai_raw: null,
    silhouette: overrides.silhouette || 'regular',
    visual_weight: 5,
    texture_intensity: 5,
    layering_role: 'standalone',
    versatility_score: 6,
    occasion_tags: [],
    style_archetype: 'classic',
    ...overrides,
  };
}

function wearLog(garmentId: string, daysAgo: number, occasion: string | null = null, eventTitle: string | null = null): WearLog {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    garment_id: garmentId,
    worn_at: d.toISOString(),
    occasion,
    event_title: eventTitle,
  };
}

describe('buildWearContext', () => {
  it('returns nulls (except transInfo) for an empty wear log', () => {
    const ctx = buildWearContext([], [], []);
    expect(ctx.wearPatterns).toBeNull();
    expect(ctx.styleVector).toBeNull();
    expect(ctx.socialMap).toBeNull();
    expect(ctx.comfortProfile).toBeNull();
    expect(ctx.personalUniform).toBeNull();
    expect(ctx.transInfo).toBeDefined();
    expect(typeof ctx.transInfo.currentSeason).toBe('string');
    expect(typeof ctx.transInfo.isTransitional).toBe('boolean');
  });

  it('builds wearPatterns + socialMap with even a single log', () => {
    const g = garment({ id: 'g1' });
    const ctx = buildWearContext(
      [wearLog('g1', 5, 'work', 'Standup')],
      [g],
      [],
    );
    expect(ctx.wearPatterns).not.toBeNull();
    expect(ctx.socialMap).not.toBeNull();
    expect(ctx.socialMap!.contextGarments.size).toBeGreaterThan(0);
    // <5 logs → styleVector / comfortProfile still null
    expect(ctx.styleVector).toBeNull();
    expect(ctx.comfortProfile).toBeNull();
    expect(ctx.personalUniform).toBeNull();
  });

  it('builds styleVector + comfortProfile once log count >= 5', () => {
    const g = garment({ id: 'g1' });
    const logs: WearLog[] = Array.from({ length: 5 }).map((_, i) => wearLog('g1', i + 1));
    const ctx = buildWearContext(logs, [g], []);
    expect(ctx.styleVector).not.toBeNull();
    expect(ctx.comfortProfile).not.toBeNull();
  });

  it('builds personalUniform once log count >= 15 with consistent silhouettes', () => {
    const top = garment({ id: 'top1', category: 'shirt', silhouette: 'fitted' });
    const bottom = garment({ id: 'bot1', category: 'pants', silhouette: 'straight' });
    const shoes = garment({ id: 'shoe1', category: 'sneakers', subcategory: 'sneakers' });
    const logs: WearLog[] = [];
    for (let i = 1; i <= 15; i++) {
      logs.push(wearLog('top1', i));
      logs.push(wearLog('bot1', i));
      logs.push(wearLog('shoe1', i));
    }
    const ctx = buildWearContext(logs, [top, bottom, shoes], []);
    // With 15 distinct days × 3 garments = 15 day-groups consistent → uniform
    expect(ctx.personalUniform).not.toBeNull();
    expect(ctx.personalUniform!.formula).toBeDefined();
  });

  it('comfortProfile reflects feedback contribution when feedbackSignals non-empty', () => {
    const g = garment({ id: 'g1' });
    const logs: WearLog[] = Array.from({ length: 6 }).map((_, i) => wearLog('g1', i + 1));

    const withoutFeedback = buildWearContext(logs, [g], []);
    expect(withoutFeedback.comfortProfile).not.toBeNull();

    // Strong positive rating should produce an aspiration / comfort signal
    // entry for the garment that the no-feedback profile lacks. We use a
    // fresh-feedback timestamp so the decay weight is ~1.
    const feedbackSignals: FeedbackSignal[] = [
      {
        garmentIds: new Set(['g1']),
        rating: 5,
        feedback: ['loved_it'],
        weather: null,
        generatedAt: new Date().toISOString(),
      },
    ];
    const withFeedback = buildWearContext(logs, [g], feedbackSignals);
    expect(withFeedback.comfortProfile).not.toBeNull();

    // The two profiles must differ — proving that `feedbackSignals` is
    // passed through to `buildComfortStyleProfile`, not silently dropped.
    // Aspiration weights are derived from the feedback rating; without
    // feedback the aspiration channel is dark.
    const aspirationWithout = withoutFeedback.comfortProfile!.garmentSignals.get('g1')?.aspiration ?? 0;
    const aspirationWith = withFeedback.comfortProfile!.garmentSignals.get('g1')?.aspiration ?? 0;
    expect(aspirationWith).toBeGreaterThan(aspirationWithout);
  });

  it('transInfo is independent of wear-log inputs', () => {
    const a = buildWearContext([], [], []);
    const b = buildWearContext([wearLog('g', 1)], [garment({ id: 'g' })], []);
    expect(a.transInfo.currentSeason).toBe(b.transInfo.currentSeason);
    expect(a.transInfo.isTransitional).toBe(b.transInfo.isTransitional);
  });
});
