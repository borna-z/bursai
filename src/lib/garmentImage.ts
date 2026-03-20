const PROCESSING_PHASES = [
  'Preparing your garment',
  'Removing background',
  'Cleaning the cutout',
  'Finalizing wardrobe image',
] as const;

export type GarmentProcessingPhase = (typeof PROCESSING_PHASES)[number];

type GarmentImageLike = {
  image_path?: string | null;
  original_image_path?: string | null;
  processed_image_path?: string | null;
  image_processing_status?: string | null;
};

export function getPreferredGarmentImagePath(garment: GarmentImageLike): string | undefined {
  if (garment.image_processing_status === 'ready' && garment.processed_image_path) {
    return garment.processed_image_path;
  }

  return garment.original_image_path || garment.image_path || undefined;
}

export function getGarmentProcessingMessage(status: string | null | undefined): { label: string; tone: 'muted' | 'success' } | null {
  switch (status) {
    case 'pending':
      return { label: 'Preparing wardrobe image', tone: 'muted' };
    case 'processing':
      return { label: 'Removing background', tone: 'muted' };
    case 'ready':
      return { label: 'Background removed', tone: 'success' };
    case 'failed':
      return { label: 'Original photo kept', tone: 'muted' };
    default:
      return null;
  }
}

export function getGarmentProcessingPhases(): readonly GarmentProcessingPhase[] {
  return PROCESSING_PHASES;
}
