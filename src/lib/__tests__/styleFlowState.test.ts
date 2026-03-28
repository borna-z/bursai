import { describe, expect, it } from 'vitest';
import {
  buildStyleFlowSearch,
  createStyleFlowNavigationState,
  extractStyleFlowGarmentIds,
  extractStyleFlowGarmentIdsFromSearch,
  extractStyleFlowOccasion,
  extractStyleFlowOutfitId,
  extractStyleFlowPrefillMessage,
  extractStyleFlowSeedOutfitIds,
  extractStyleFlowStyles,
  resolveStyleFlowGarmentIds,
  resolveStyleFlowLocationState,
} from '@/lib/styleFlowState';

describe('styleFlowState', () => {
  it('collects and deduplicates garment ids from supported state fields', () => {
    expect(extractStyleFlowGarmentIds({
      selectedGarmentId: 'g-1',
      selectedGarmentIds: ['g-2', 'g-1', '', 'g-3'],
      garmentIds: ['g-3', 'g-4'],
    })).toEqual(['g-1', 'g-2', 'g-3', 'g-4']);
  });

  it('returns an empty garment id list for invalid state', () => {
    expect(extractStyleFlowGarmentIds(null)).toEqual([]);
    expect(extractStyleFlowGarmentIds('bad')).toEqual([]);
  });

  it('builds and reads garment ids from iterable search params', () => {
    const search = buildStyleFlowSearch(['g-1', 'g-2', 'g-1', '', 'g-3']);

    expect(search).toBe('?garments=g-1%2Cg-2%2Cg-3');
    expect(extractStyleFlowGarmentIdsFromSearch(search)).toEqual(['g-1', 'g-2', 'g-3']);
  });

  it('supports single-garment search params for anchored style flows', () => {
    expect(buildStyleFlowSearch('g-1')).toBe('?selectedGarmentId=g-1&garments=g-1');
    expect(resolveStyleFlowLocationState({
      search: '?selectedGarmentId=from-query&garments=from-query',
      state: null,
    })).toEqual({
      selectedGarmentId: 'from-query',
      prefillMessage: null,
    });
  });

  it('prefers garment ids from search over transient state', () => {
    expect(resolveStyleFlowGarmentIds('?garments=g-9%2Cg-8', {
      selectedGarmentId: 'g-1',
      selectedGarmentIds: ['g-2'],
    })).toEqual(['g-9', 'g-8']);
  });

  it('resolves the garment from location state before query params', () => {
    expect(resolveStyleFlowLocationState({
      search: '?selectedGarmentId=from-query&garments=from-query',
      state: createStyleFlowNavigationState('from-state'),
    })).toEqual({
      selectedGarmentId: 'from-state',
      prefillMessage: null,
    });
  });

  it('extracts outfit ids and prefill messages only when valid strings', () => {
    expect(extractStyleFlowOutfitId({ outfitId: 'outfit-1' })).toBe('outfit-1');
    expect(extractStyleFlowOutfitId({ outfitId: '' })).toBeNull();

    expect(extractStyleFlowPrefillMessage({ prefillMessage: 'Refine this look' })).toBe('Refine this look');
    expect(extractStyleFlowPrefillMessage({ prefillMessage: '   ' })).toBeNull();
  });

  it('extracts and deduplicates seed outfit ids', () => {
    expect(extractStyleFlowSeedOutfitIds({
      seedOutfitIds: ['g-1', 'g-2', 'g-1', '', 'g-3'],
    })).toEqual(['g-1', 'g-2', 'g-3']);

    expect(extractStyleFlowSeedOutfitIds(null)).toEqual([]);
  });

  it('extracts prefilled occasion and styles', () => {
    expect(extractStyleFlowOccasion({ prefillOccasion: 'work' })).toBe('work');
    expect(extractStyleFlowOccasion({ prefillOccasion: '  ' })).toBeNull();
    expect(extractStyleFlowStyles({ prefillStyle: 'Minimal, Smart Casual, Minimal' })).toEqual(['Minimal', 'Smart Casual']);
    expect(extractStyleFlowStyles({ prefillStyle: '' })).toEqual([]);
  });
});
