export interface StyleFlowLocationState {
  selectedGarmentId?: string;
  selectedGarmentIds?: string[];
  garmentIds?: string[];
  outfitId?: string;
  prefillMessage?: string;
  prefillOccasion?: string;
  prefillStyle?: string;
  seedOutfitIds?: string[];
}

const GARMENTS_PARAM = 'garments';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function extractStyleFlowGarmentIds(state: unknown): string[] {
  if (!state || typeof state !== 'object') return [];

  const typedState = state as StyleFlowLocationState;
  const candidates = [
    typedState.selectedGarmentId,
    ...(Array.isArray(typedState.selectedGarmentIds) ? typedState.selectedGarmentIds : []),
    ...(Array.isArray(typedState.garmentIds) ? typedState.garmentIds : []),
  ];

  return Array.from(new Set(candidates.filter(isNonEmptyString)));
}

export function extractStyleFlowGarmentIdsFromSearch(search: string): string[] {
  const params = new URLSearchParams(search);
  const rawGarments = params.get(GARMENTS_PARAM);
  if (!rawGarments) return [];

  return Array.from(new Set(rawGarments.split(',').filter(isNonEmptyString)));
}

export function resolveStyleFlowGarmentIds(search: string, state: unknown): string[] {
  const searchGarmentIds = extractStyleFlowGarmentIdsFromSearch(search);
  if (searchGarmentIds.length > 0) return searchGarmentIds;
  return extractStyleFlowGarmentIds(state);
}

export function buildStyleFlowSearch(garmentIds: Iterable<unknown>): string {
  const ids = Array.from(new Set(Array.from(garmentIds).filter(isNonEmptyString)));
  if (!ids.length) return '';

  const params = new URLSearchParams();
  params.set(GARMENTS_PARAM, ids.join(','));
  return `?${params.toString()}`;
}

export function extractStyleFlowOutfitId(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const outfitId = (state as StyleFlowLocationState).outfitId;
  return isNonEmptyString(outfitId) ? outfitId : null;
}

export function extractStyleFlowPrefillMessage(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const prefillMessage = (state as StyleFlowLocationState).prefillMessage;
  return isNonEmptyString(prefillMessage) ? prefillMessage : null;
}

export function extractStyleFlowOccasion(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const prefillOccasion = (state as StyleFlowLocationState).prefillOccasion;
  return isNonEmptyString(prefillOccasion) ? prefillOccasion.trim() : null;
}

export function extractStyleFlowStyles(state: unknown): string[] {
  if (!state || typeof state !== 'object') return [];

  const prefillStyle = (state as StyleFlowLocationState).prefillStyle;
  if (!isNonEmptyString(prefillStyle)) return [];

  return Array.from(new Set(
    prefillStyle
      .split(',')
      .map((value) => value.trim())
      .filter(isNonEmptyString),
  ));
}

export function extractStyleFlowSeedOutfitIds(state: unknown): string[] {
  if (!state || typeof state !== 'object') return [];
  const seedOutfitIds = (state as StyleFlowLocationState).seedOutfitIds;
  return Array.isArray(seedOutfitIds) ? Array.from(new Set(seedOutfitIds.filter(isNonEmptyString))) : [];
}
