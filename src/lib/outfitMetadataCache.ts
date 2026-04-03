export interface CachedOutfitMetadata {
  justGenerated?: boolean;
  limitation_note?: string | null;
  family_label?: string;
  wardrobe_insights?: string[];
  layer_order?: { slot: string; garment_id: string; layer_role: string }[];
  needs_base_layer?: boolean;
  occasion_submode?: string | null;
  outfit_reasoning?: {
    why_it_works?: string;
    occasion_fit?: string;
    weather_logic?: string | null;
    color_note?: string;
  };
}

const CACHE_KEY = 'burs.outfit-metadata-cache';
const MAX_ENTRIES = 40;

function canUseSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readCache(): Record<string, CachedOutfitMetadata> {
  if (!canUseSessionStorage()) return {};

  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedOutfitMetadata>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, CachedOutfitMetadata>) {
  if (!canUseSessionStorage()) return;

  try {
    const entries = Object.entries(cache).slice(-MAX_ENTRIES);
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Best-effort only.
  }
}

export function cacheOutfitMetadata(outfitId: string, metadata: CachedOutfitMetadata) {
  if (!outfitId) return;
  const cache = readCache();
  cache[outfitId] = metadata;
  writeCache(cache);
}

export function readCachedOutfitMetadata(outfitId?: string | null): CachedOutfitMetadata | null {
  if (!outfitId) return null;
  const cache = readCache();
  return cache[outfitId] || null;
}
