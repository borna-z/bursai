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
const SELECTED_GARMENT_PARAM = 'selectedGarmentId';

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

export function buildStyleFlowSearch(garmentIds?: string | null | Iterable<unknown>): string {
  if (typeof garmentIds === 'string') {
    if (!isNonEmptyString(garmentIds)) return '';

    const params = new URLSearchParams();
    params.set(SELECTED_GARMENT_PARAM, garmentIds);
    params.set(GARMENTS_PARAM, garmentIds);
    return `?${params.toString()}`;
  }

  if (!garmentIds) return '';

  const ids = Array.from(new Set(Array.from(garmentIds).filter(isNonEmptyString)));
  if (!ids.length) return '';

  const params = new URLSearchParams();
  params.set(GARMENTS_PARAM, ids.join(','));
  if (ids.length === 1) params.set(SELECTED_GARMENT_PARAM, ids[0]);
  return `?${params.toString()}`;
}

export function createStyleFlowNavigationState(selectedGarmentId: string): StyleFlowLocationState {
  return {
    selectedGarmentId,
    selectedGarmentIds: [selectedGarmentId],
    garmentIds: [selectedGarmentId],
  };
}

export function buildStyleAroundState(selectedGarmentId: string): StyleFlowLocationState {
  return {
    ...createStyleFlowNavigationState(selectedGarmentId),
    prefillMessage: 'Style around this garment and build a complete look around it.',
  };
}

export function resolveStyleFlowLocationState({
  search,
  state,
}: {
  search: string;
  state: unknown;
}): Required<Pick<StyleFlowLocationState, 'prefillMessage'>> & { selectedGarmentId: string | null } {
  const locationState = (state as StyleFlowLocationState | null) ?? null;
  const params = new URLSearchParams(search);
  const stateGarmentId = locationState?.selectedGarmentId ?? extractStyleFlowGarmentIds(locationState)[0] ?? null;
  const searchGarmentId = params.get(SELECTED_GARMENT_PARAM) ?? extractStyleFlowGarmentIdsFromSearch(search)[0] ?? null;

  return {
    selectedGarmentId: stateGarmentId ?? searchGarmentId,
    prefillMessage: locationState?.prefillMessage ?? null,
  };
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
