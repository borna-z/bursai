export const COMPLETE_OUTFIT_RECOVERY_MESSAGE =
  'Could not create a complete outfit with your wardrobe. Add shoes or another core piece and try again.';

export const PREFERRED_GARMENT_RECOVERY_MESSAGE =
  'Could not create a complete outfit around the selected garment. Try another piece or adjust the occasion.';

export function isPreferredGarmentGenerationError(message?: string | null): boolean {
  return (message ?? '').toLowerCase().includes('selected garment');
}

export function humanizeOutfitGenerationError(message?: string | null): string {
  if (isPreferredGarmentGenerationError(message)) {
    return PREFERRED_GARMENT_RECOVERY_MESSAGE;
  }

  const normalized = (message ?? '').toLowerCase();
  if (normalized.includes('incomplete outfit') || normalized.includes('could not create a complete outfit')) {
    return COMPLETE_OUTFIT_RECOVERY_MESSAGE;
  }

  return message || 'Could not generate outfit';
}
