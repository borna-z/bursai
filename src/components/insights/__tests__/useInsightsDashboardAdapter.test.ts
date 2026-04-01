import { describe, expect, it } from 'vitest';

import type { InsightsDashboardData } from '@/hooks/useInsightsDashboard';

import { createInsightsDashboardViewModel } from '../useInsightsDashboardAdapter';

function makeDashboard(overrides: Partial<InsightsDashboardData> = {}): InsightsDashboardData {
  return {
    generatedAt: '2026-04-02T10:30:00.000Z',
    metricVersion: '2026-03-28.v1',
    overview: {
      totalGarments: 12,
      garmentsUsedLast30Days: 8,
      unusedGarmentsLast30Days: 4,
      usageRate: 67,
      savedLooks: 9,
      plannedThisWeek: 3,
    },
    styleDna: {
      archetype: 'Minimalist',
      signatureColors: [
        { color: 'black', percentage: 50 },
        { color: 'navy', percentage: 25 },
      ],
      formalityCenter: 3.1,
      formalitySpread: 'moderate',
      uniformCombos: [
        { combo: ['shirt', 'trousers', 'loafers'], count: 4 },
      ],
      patterns: [
        { label: 'Neutral palette', strength: 78, detail: '78% of recent wears stay in neutral tones.' },
      ],
      outfitsAnalyzed: 12,
    },
    behavior: {
      consistency: 61,
      heatmapDays: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        status: index % 3 === 0 ? 'planned' : index % 2 === 0 ? 'improvised' : 'none',
      })),
      repeats: [
        { id: 'outfit-1', occasion: 'Office look', wornCount: 3, lastWorn: '2026-03-27', daysSince: 6 },
      ],
      staleOutfits: [
        { id: 'outfit-2', occasion: 'Dinner look', daysSince: 74 },
      ],
      streak: 5,
    },
    value: {
      spending: {
        totalValue: 1850,
        currency: 'USD',
        categoryBreakdown: [
          { category: 'tops', total: 450, count: 4 },
          { category: 'outerwear', total: 800, count: 2 },
        ],
        topCostPerWear: [
          { id: 'garment-best', title: 'Black Tee', image_path: null, cpw: 4, wears: 20, price: 80 },
        ],
        worstCostPerWear: [
          { id: 'garment-worst', title: 'Statement Coat', image_path: null, cpw: 300, wears: 2, price: 600 },
        ],
      },
      sustainability: {
        score: 82,
        utilizationRate: 67,
        avgWearCount: 7.4,
        underusedCount: 4,
        totalGarments: 12,
      },
    },
    wardrobeHealth: {
      categoryBalance: [
        { name: 'tops', count: 5, percentage: 42 },
        { name: 'trousers', count: 3, percentage: 25 },
      ],
      colorTemperature: {
        temperature: -0.2,
        warmCount: 2,
        coolCount: 3,
        neutralCount: 7,
        totalChromatic: 5,
        dominantPalette: 'balanced',
      },
      forgottenGems: [
        {
          id: 'garment-forgotten',
          title: 'Grey Blazer',
          image_path: null,
          category: 'outerwear',
          subcategory: null,
          color_primary: 'grey',
          color_secondary: null,
          material: null,
          fit: null,
          formality: 4,
          season_tags: [],
          wear_count: 4,
          last_worn_at: '2026-01-10',
          created_at: '2025-11-10',
          purchase_price: 320,
          purchase_currency: 'USD',
        },
      ],
      topFiveWorn: [
        {
          id: 'garment-top',
          title: 'Black Tee',
          image_path: null,
          category: 'tops',
          subcategory: null,
          color_primary: 'black',
          color_secondary: null,
          material: null,
          fit: null,
          formality: 1,
          season_tags: [],
          wear_count: 20,
          last_worn_at: '2026-03-31',
          created_at: '2025-09-12',
          purchase_price: 80,
          purchase_currency: 'USD',
          wearCountLast30: 6,
        },
      ],
      usedGarments: [
        {
          id: 'garment-top',
          title: 'Black Tee',
          image_path: null,
          category: 'tops',
          subcategory: null,
          color_primary: 'black',
          color_secondary: null,
          material: null,
          fit: null,
          formality: 1,
          season_tags: [],
          wear_count: 20,
          last_worn_at: '2026-03-31',
          created_at: '2025-09-12',
          purchase_price: 80,
          purchase_currency: 'USD',
          wearCountLast30: 6,
        },
      ],
      unusedGarments: [
        {
          id: 'garment-forgotten',
          title: 'Grey Blazer',
          image_path: null,
          category: 'outerwear',
          subcategory: null,
          color_primary: 'grey',
          color_secondary: null,
          material: null,
          fit: null,
          formality: 4,
          season_tags: [],
          wear_count: 4,
          last_worn_at: '2026-01-10',
          created_at: '2025-11-10',
          purchase_price: 320,
          purchase_currency: 'USD',
        },
      ],
    },
    ...overrides,
  };
}

describe('createInsightsDashboardViewModel', () => {
  it('normalizes the dashboard into a premium-ready page model', () => {
    const viewModel = createInsightsDashboardViewModel({
      dashboard: makeDashboard(),
      isPremium: true,
      isLoading: false,
      isRefreshing: false,
      hasError: false,
      locale: 'en-US',
    });

    expect(viewModel.state).toBe('ready');
    expect(viewModel.hero.score).toBe(82);
    expect(viewModel.hero.metrics[0].value).toBe('8/12');
    expect(viewModel.style.archetype).toBe('Minimalist');
    expect(viewModel.palette.entries[0]).toMatchObject({
      color: 'black',
      percentage: 50,
    });
    expect(viewModel.health.pressureLabel).toBe('Category concentration');
    expect(viewModel.actions[0]).toMatchObject({
      id: 'forgotten-piece',
      target: { kind: 'style-garment', garmentId: 'garment-forgotten' },
    });
    expect(viewModel.value.totalValue).toContain('$');
  });

  it('moves into the no-wear-data state when garments exist but nothing has been worn recently', () => {
    const viewModel = createInsightsDashboardViewModel({
      dashboard: makeDashboard({
        overview: {
          totalGarments: 12,
          garmentsUsedLast30Days: 0,
          unusedGarmentsLast30Days: 12,
          usageRate: 0,
          savedLooks: 3,
          plannedThisWeek: 0,
        },
        behavior: {
          consistency: 0,
          heatmapDays: [],
          repeats: [],
          staleOutfits: [],
          streak: 0,
        },
        wardrobeHealth: {
          ...makeDashboard().wardrobeHealth,
          usedGarments: [],
          topFiveWorn: [],
        },
      }),
      isPremium: false,
      isLoading: false,
      isRefreshing: false,
      hasError: false,
      locale: 'en-US',
    });

    expect(viewModel.state).toBe('no-wear-data');
    expect(viewModel.hero.summary).toContain('Start logging wears');
    expect(viewModel.actions.some((action) => action.id === 'plan-week')).toBe(true);
  });

  it('preserves premium lock signals for locked sections on free plans', () => {
    const viewModel = createInsightsDashboardViewModel({
      dashboard: makeDashboard(),
      isPremium: false,
      isLoading: false,
      isRefreshing: false,
      hasError: false,
      locale: 'en-US',
    });

    expect(viewModel.palette.locked).toBe(true);
    expect(viewModel.behavior.locked).toBe(true);
    expect(viewModel.value.locked).toBe(true);
    expect(viewModel.upgrade.show).toBe(true);
  });
});
