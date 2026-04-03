import { inferOutfitSlotFromGarment, type OutfitWeatherContext } from '@/lib/outfitValidation';

export type RecoverableGarment = {
  id: string;
  category?: string | null;
  subcategory?: string | null;
  wear_count?: number | null;
  layering_role?: string | null;
  in_laundry?: boolean | null;
};

export type RecoverableOutfitItem<TGarment extends RecoverableGarment = RecoverableGarment> = {
  slot: string;
  garment: TGarment;
};

function normalizeValue(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function requiresOuterwear(weather?: OutfitWeatherContext): boolean {
  const temp = weather?.temperature;
  const precipitation = normalizeValue(weather?.precipitation);
  const wind = normalizeValue(weather?.wind);
  const coldEnough = temp !== undefined && temp < 8;
  const wet = precipitation !== '' && !['none', 'ingen'].includes(precipitation);
  const snowy = precipitation.includes('snow') || precipitation.includes('sno');
  const highWind = wind === 'high' || wind === 'hog' || wind === 'hög';
  return coldEnough || wet || snowy || highWind;
}

function isWeatherSuitableOptionalGarment(
  slot: 'shoes' | 'outerwear',
  garment: RecoverableGarment,
  weather?: OutfitWeatherContext,
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

function chooseLowestWear<T extends RecoverableGarment>(garments: T[]): T | null {
  if (!garments.length) return null;
  return [...garments].sort((a, b) => (a.wear_count ?? 0) - (b.wear_count ?? 0))[0] || null;
}

function chooseCoreGarment<T extends RecoverableGarment>(garments: T[], slot: 'top' | 'bottom' | 'dress'): T | null {
  const filtered = garments.filter((garment) => {
    if (inferOutfitSlotFromGarment(garment) !== slot) return false;
    if (slot === 'top') {
      const role = normalizeValue(garment.layering_role || 'standalone');
      return role !== 'mid';
    }
    return true;
  });
  return chooseLowestWear(filtered);
}

function chooseOptionalGarment<T extends RecoverableGarment>(
  garments: T[],
  slot: 'shoes' | 'outerwear',
  weather?: OutfitWeatherContext,
): T | null {
  const matching = garments.filter((garment) => inferOutfitSlotFromGarment(garment) === slot);
  const weatherReady = matching.filter((garment) => isWeatherSuitableOptionalGarment(slot, garment, weather));
  return chooseLowestWear(weatherReady.length ? weatherReady : matching);
}

export function repairIncompleteOutfitItems<TGarment extends RecoverableGarment>(
  items: RecoverableOutfitItem<TGarment>[],
  wardrobe: TGarment[],
  weather?: OutfitWeatherContext,
): RecoverableOutfitItem<TGarment>[] {
  const availableWardrobe = wardrobe.filter((garment) => garment && garment.id && garment.in_laundry !== true);
  if (!availableWardrobe.length) return items;

  const repaired = [...items];
  const usedGarmentIds = new Set(repaired.map((item) => item.garment.id));
  const currentSlots = new Set(repaired.map((item) => item.slot));

  const remaining = () => availableWardrobe.filter((garment) => !usedGarmentIds.has(garment.id));
  const addItem = (slot: string, garment: TGarment | null) => {
    if (!garment) return;
    repaired.push({ slot, garment });
    usedGarmentIds.add(garment.id);
    currentSlots.add(slot);
  };

  const hasDress = currentSlots.has('dress');
  const hasTop = currentSlots.has('top');
  const hasBottom = currentSlots.has('bottom');

  if (!hasDress && !hasTop && !hasBottom) {
    const dress = chooseCoreGarment(remaining(), 'dress');
    addItem('dress', dress);
    if (!currentSlots.has('dress')) {
      addItem('top', chooseCoreGarment(remaining(), 'top'));
      addItem('bottom', chooseCoreGarment(remaining(), 'bottom'));
    }
  } else if (!hasDress) {
    if (!hasTop) addItem('top', chooseCoreGarment(remaining(), 'top'));
    if (!hasBottom) addItem('bottom', chooseCoreGarment(remaining(), 'bottom'));
  }

  if (!currentSlots.has('shoes')) {
    addItem('shoes', chooseOptionalGarment(remaining(), 'shoes', weather));
  }

  if (requiresOuterwear(weather) && !currentSlots.has('outerwear')) {
    addItem('outerwear', chooseOptionalGarment(remaining(), 'outerwear', weather));
  }

  return repaired;
}
