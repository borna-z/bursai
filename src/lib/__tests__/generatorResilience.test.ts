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

function chooseBestCoreGarment<T extends { wear_count?: number | null }>(garments: T[]): T | null {
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

  const addBestCoreSlot = (slot: 'top' | 'bottom' | 'dress') => {
    if (slots.has(slot)) return;
    const garment = chooseBestCoreGarment(
      garments.filter((candidate) => !garmentIds.has(candidate.id) && inferSlotFromGarment(candidate) === slot),
    );
    if (!garment) return;
    enriched.push({ slot, garment_id: garment.id });
    garmentIds.add(garment.id);
    slots.add(slot);
  };

  const hasDress = slots.has('dress');
  const hasTop = slots.has('top');
  const hasBottom = slots.has('bottom');

  if (!hasDress && !hasTop && !hasBottom) {
    addBestCoreSlot('dress');
    if (!slots.has('dress')) {
      addBestCoreSlot('top');
      addBestCoreSlot('bottom');
    }
  } else if (!hasDress) {
    if (!hasTop) addBestCoreSlot('top');
    if (!hasBottom) addBestCoreSlot('bottom');
  }

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

function isWeatherSuitableOptionalGarment(
  slot: 'shoes' | 'outerwear',
  garment: GarmentLike,
  weather?: { temperature?: number; precipitation?: string | null },
): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const text = `${normalizeValue(garment.category)} ${normalizeValue(garment.subcategory)}`.trim();
  const isWet = precipitation.includes('rain') || precipitation.includes('snow') || precipitation.includes('regn') || precipitation.includes('sno');
  const isCold = temp !== undefined && temp < 10;
  const isHot = temp !== undefined && temp > 24;

  if (slot === 'shoes') {
    if (isWet || isCold) return !text.includes('sandal');
    if (isHot && text.includes('boot')) return false;
  }

  if (slot === 'outerwear') {
    if (!requiresOuterwear(weather)) return true;
    if (isWet) return ['rain', 'trench', 'coat', 'jacket', 'jacka', 'kappa'].some((token) => text.includes(token));
    if (isCold) return ['coat', 'jacket', 'parka', 'jacka', 'kappa'].some((token) => text.includes(token));
  }

  return true;
}

function buildPrimaryTopSeeds(tops: ScoredGarmentLike[]): ScoredGarmentLike[] {
  return tops.filter((top) => {
    const role = top.garment.layering_role || 'standalone';
    return role === 'base' || role === 'standalone';
  });
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

  it('mood outfit enrichment repairs a missing top before failing the outfit', () => {
    const items = [
      { slot: 'bottom', garment_id: 'bottom-1' },
      { slot: 'shoes', garment_id: 'shoe-1' },
    ];
    const garments: GarmentLike[] = [
      { id: 'top-1', category: 'top', wear_count: 2 },
      { id: 'bottom-1', category: 'bottom', wear_count: 3 },
      { id: 'shoe-1', category: 'shoes', wear_count: 4 },
    ];

    const enriched = enrichMoodOutfitItems(items, garments, { temperature: 18, precipitation: 'none' });

    expect(enriched.map((item) => item.slot)).toEqual(expect.arrayContaining(['top', 'bottom', 'shoes']));
    expect(enriched.find((item) => item.slot === 'top')?.garment_id).toBe('top-1');
  });

  it('weather-aware optional shoes reject sandals for rainy mood outfits', () => {
    expect(isWeatherSuitableOptionalGarment(
      'shoes',
      { id: 'shoe-1', category: 'sandals' },
      { temperature: 11, precipitation: 'rain' },
    )).toBe(false);

    expect(isWeatherSuitableOptionalGarment(
      'shoes',
      { id: 'shoe-2', category: 'boots' },
      { temperature: 11, precipitation: 'rain' },
    )).toBe(true);
  });

  it('style engine does not promote mid-layers to standalone tops', () => {
    const topSeeds = buildPrimaryTopSeeds([
      { garment: { id: 'top-1', category: 'top', layering_role: 'mid' } },
      { garment: { id: 'top-2', category: 'shirt', layering_role: 'mid' } },
    ]);

    expect(topSeeds).toHaveLength(0);
  });
});
