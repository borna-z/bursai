import { describe, expect, it } from 'vitest';

type GarmentLike = {
  id: string;
  category?: string | null;
  subcategory?: string | null;
  wear_count?: number | null;
  layering_role?: string | null;
};

type ScoredGarmentLike = {
  garment: GarmentLike;
};

const SHOES_TOKENS = ['shoes', 'shoe', 'sneakers', 'boots', 'heels', 'sandals', 'loafers', 'skor', 'stövlar'];
const OUTERWEAR_TOKENS = ['outerwear', 'coat', 'jacket', 'blazer', 'trench', 'jacka', 'kappa'];
const DRESS_TOKENS = ['dress', 'jumpsuit', 'overall', 'klänning'];
const BOTTOM_TOKENS = ['bottom', 'pants', 'jeans', 'trousers', 'shorts', 'skirt', 'byxor', 'kjol'];

function normalizeValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function inferSlotFromGarment(garment: GarmentLike): string {
  const value = `${normalizeValue(garment.category)} ${normalizeValue(garment.subcategory)}`.trim();
  if (DRESS_TOKENS.some((token) => value.includes(token))) return 'dress';
  if (SHOES_TOKENS.some((token) => value.includes(token))) return 'shoes';
  if (OUTERWEAR_TOKENS.some((token) => value.includes(token))) return 'outerwear';
  if (BOTTOM_TOKENS.some((token) => value.includes(token))) return 'bottom';
  return 'top';
}

function requiresOuterwear(weather?: { temperature?: number; precipitation?: string | null }): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);
  const snowy = precipitation.includes('snow') || precipitation.includes('snö');
  return coldEnough || wet || snowy;
}

function chooseBestOptionalGarment<T extends { wear_count?: number | null }>(garments: T[]): T | null {
  if (garments.length === 0) return null;
  return [...garments].sort((a, b) => (a.wear_count ?? 0) - (b.wear_count ?? 0))[0] || null;
}

function enrichMoodOutfitItems(
  items: { slot: string; garment_id: string }[],
  garments: GarmentLike[],
  weather?: { temperature?: number; precipitation?: string | null },
): { slot: string; garment_id: string }[] {
  const enriched = [...items];
  const garmentIds = new Set(enriched.map((item) => item.garment_id));
  const slots = new Set(enriched.map((item) => item.slot));

  if (!slots.has('shoes')) {
    const shoe = chooseBestOptionalGarment(
      garments.filter((garment) => !garmentIds.has(garment.id) && inferSlotFromGarment(garment) === 'shoes'),
    );
    if (shoe) {
      enriched.push({ slot: 'shoes', garment_id: shoe.id });
      garmentIds.add(shoe.id);
      slots.add('shoes');
    }
  }

  if (requiresOuterwear(weather) && !slots.has('outerwear')) {
    const outerwear = chooseBestOptionalGarment(
      garments.filter((garment) => !garmentIds.has(garment.id) && inferSlotFromGarment(garment) === 'outerwear'),
    );
    if (outerwear) {
      enriched.push({ slot: 'outerwear', garment_id: outerwear.id });
    }
  }

  return enriched;
}

function buildPrimaryTopSeeds(tops: ScoredGarmentLike[]): ScoredGarmentLike[] {
  const baseTops = tops.filter((top) => {
    const role = top.garment.layering_role || 'standalone';
    return role === 'base' || role === 'standalone';
  });
  const midLayers = tops.filter((top) => (top.garment.layering_role || 'standalone') === 'mid');

  return baseTops.length > 0
    ? baseTops
    : midLayers.map((top) => ({
        ...top,
        garment: {
          ...top.garment,
          layering_role: 'standalone',
        },
      }));
}

describe('generator resilience mirrors', () => {
  it('mood outfit enrichment adds shoes when shoes are available', () => {
    const items = [
      { slot: 'top', garment_id: 'top-1' },
      { slot: 'bottom', garment_id: 'bottom-1' },
    ];
    const garments: GarmentLike[] = [
      { id: 'top-1', category: 'top', wear_count: 3 },
      { id: 'bottom-1', category: 'bottom', wear_count: 2 },
      { id: 'shoe-1', category: 'shoes', wear_count: 5 },
      { id: 'shoe-2', category: 'boots', wear_count: 0 },
    ];

    const enriched = enrichMoodOutfitItems(items, garments, { temperature: 18, precipitation: 'none' });

    expect(enriched.map((item) => item.slot)).toContain('shoes');
    expect(enriched.find((item) => item.slot === 'shoes')?.garment_id).toBe('shoe-2');
  });

  it('style engine primary-top fallback recovers when all tops are tagged mid-layer', () => {
    const topSeeds = buildPrimaryTopSeeds([
      { garment: { id: 'top-1', category: 'top', layering_role: 'mid' } },
      { garment: { id: 'top-2', category: 'shirt', layering_role: 'mid' } },
    ]);

    expect(topSeeds).toHaveLength(2);
    expect(topSeeds.every((top) => top.garment.layering_role === 'standalone')).toBe(true);
  });
});
