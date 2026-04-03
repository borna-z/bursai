import { beforeEach, describe, expect, it } from 'vitest';

import { cacheOutfitMetadata, readCachedOutfitMetadata } from '../outfitMetadataCache';

describe('outfitMetadataCache', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('reads cached metadata back by outfit id', () => {
    cacheOutfitMetadata('outfit-1', {
      justGenerated: true,
      family_label: 'City layers',
      occasion_submode: 'travel',
    });

    expect(readCachedOutfitMetadata('outfit-1')).toEqual({
      justGenerated: true,
      family_label: 'City layers',
      occasion_submode: 'travel',
    });
  });

  it('returns null for missing cached metadata', () => {
    expect(readCachedOutfitMetadata('missing-outfit')).toBeNull();
  });
});
