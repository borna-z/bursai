import { describe, expect, it } from 'vitest';

type GarmentLike = {
  id: string;
  category?: string | null;
  subcategory?: string | null;
  wear_count?: number | null;
};

function normalizeValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function inferSlotFromGarment(garment: { category?: string | null; subcategory?: string | null }): string {
  const value = `${normalizeValue(garment.category)} ${normalizeValue(garment.subcategory)}`.trim();
  if (value.includes('dress')) return 'dress';
  if (value.includes('shoe') || value.includes('boot') || value.includes('sneaker')) return 'shoes';
  if (value.includes('outerwear') || value.includes('jacket') || value.includes('coat')) return 'outerwear';
  if (value.includes('bottom') || value.includes('pants') || value.includes('jeans') || value.includes('skirt')) return 'bottom';
  return 'top';
}

const MOOD_OUTFIT_SLOTS = new Set(['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress']);

function normalizeMoodOutfitSlot(slot: unknown): string | null {
  const normalized = normalizeValue(slot);
  return MOOD_OUTFIT_SLOTS.has(normalized) ? normalized : null;
}

function requiresOuterwear(weather?: { temperature?: number; precipitation?: string | null }): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  return (temp !== undefined && temp < 8)
    || (precipitation !== '' && !['none', 'ingen'].includes(precipitation))
    || precipitation.includes('snow')
    || precipitation.includes('sno');
}

function chooseBestOptionalGarment<T extends { wear_count?: number | null }>(garments: T[]): T | null {
  if (!garments.length) return null;
  return [...garments].sort((a, b) => (a.wear_count ?? 0) - (b.wear_count ?? 0))[0] || null;
}

function chooseBestCoreGarment<T extends { wear_count?: number | null }>(garments: T[]): T | null {
  if (!garments.length) return null;
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
    const shoes = chooseBestOptionalGarment(
      garments.filter((candidate) => !garmentIds.has(candidate.id) && inferSlotFromGarment(candidate) === 'shoes'),
    );
    if (shoes) {
      enriched.push({ slot: 'shoes', garment_id: shoes.id });
      garmentIds.add(shoes.id);
      slots.add('shoes');
    }
  }

  if (requiresOuterwear(weather) && !slots.has('outerwear')) {
    const outerwear = chooseBestOptionalGarment(
      garments.filter((candidate) => !garmentIds.has(candidate.id) && inferSlotFromGarment(candidate) === 'outerwear'),
    );
    if (outerwear) {
      enriched.push({ slot: 'outerwear', garment_id: outerwear.id });
    }
  }

  return enriched;
}

describe('mood outfit recovery mirrors', () => {
  it('preserves explicit returned slots instead of overwriting them from garment metadata', () => {
    const normalized = [
      { garment_id: 'garment-1', slot: 'dress' },
      { garment_id: 'garment-2', slot: 'shoes' },
    ]
      .map((item) => {
        const explicitSlot = normalizeMoodOutfitSlot(item.slot);
        if (!explicitSlot) return null;
        return { slot: explicitSlot, garment_id: item.garment_id };
      })
      .filter((item): item is { slot: string; garment_id: string } => Boolean(item));

    expect(normalized).toEqual([
      { garment_id: 'garment-1', slot: 'dress' },
      { garment_id: 'garment-2', slot: 'shoes' },
    ]);
    expect(inferSlotFromGarment({ category: 'bottom', subcategory: 'jeans' })).toBe('bottom');
  });

  it('repairs missing top and shoes when the AI only returns a bottom', () => {
    const enriched = enrichMoodOutfitItems(
      [{ slot: 'bottom', garment_id: 'bottom-1' }],
      [
        { id: 'top-1', category: 'top', wear_count: 1 },
        { id: 'bottom-1', category: 'bottom', wear_count: 3 },
        { id: 'shoe-1', category: 'shoes', wear_count: 2 },
      ],
      { temperature: 18, precipitation: 'none' },
    );

    expect(enriched.map((item) => item.slot)).toEqual(expect.arrayContaining(['top', 'bottom', 'shoes']));
  });

  it('prefers a complete dress path when the AI returns no usable core pieces', () => {
    const enriched = enrichMoodOutfitItems(
      [],
      [
        { id: 'dress-1', category: 'dress', wear_count: 0 },
        { id: 'top-1', category: 'top', wear_count: 4 },
        { id: 'bottom-1', category: 'bottom', wear_count: 5 },
        { id: 'shoe-1', category: 'shoes', wear_count: 1 },
      ],
      { temperature: 18, precipitation: 'none' },
    );

    expect(enriched.find((item) => item.slot === 'dress')?.garment_id).toBe('dress-1');
    expect(enriched.find((item) => item.slot === 'shoes')?.garment_id).toBe('shoe-1');
  });

  it('ignores invalid explicit slots instead of coercing them into inferred garment slots', () => {
    const normalized = [
      { garment_id: 'garment-1', slot: 'cape' },
      { garment_id: 'garment-2', slot: 'top' },
    ]
      .map((item) => {
        const explicitSlot = normalizeMoodOutfitSlot(item.slot);
        if (!explicitSlot) return null;
        return { slot: explicitSlot, garment_id: item.garment_id };
      })
      .filter((item): item is { slot: string; garment_id: string } => Boolean(item));

    expect(normalized).toEqual([{ garment_id: 'garment-2', slot: 'top' }]);
  });
});
