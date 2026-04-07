import { describe, expect, it } from 'vitest';
import {
  COMPLETE_OUTFIT_RECOVERY_MESSAGE,
  PREFERRED_GARMENT_RECOVERY_MESSAGE,
  humanizeOutfitGenerationError,
  isPreferredGarmentGenerationError,
} from '../outfitGenerationErrors';

describe('outfitGenerationErrors', () => {
  it('keeps selected garment failures specific', () => {
    expect(isPreferredGarmentGenerationError('Could not create a complete outfit around the selected garment.')).toBe(true);
    expect(humanizeOutfitGenerationError('Could not create a complete outfit around the selected garment.')).toBe(
      PREFERRED_GARMENT_RECOVERY_MESSAGE,
    );
  });

  it('normalizes generic incomplete outfit failures', () => {
    expect(humanizeOutfitGenerationError('Incomplete outfit returned. Missing: shoes')).toBe(
      COMPLETE_OUTFIT_RECOVERY_MESSAGE,
    );
  });

  it('preserves unrelated errors', () => {
    expect(humanizeOutfitGenerationError('Rate limit exceeded')).toBe('Rate limit exceeded');
  });
});
