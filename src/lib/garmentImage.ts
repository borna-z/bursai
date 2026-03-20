import type { Garment } from '@/hooks/useGarments';

const PROCESSING_PHASES = [
  'Preparing your garment',
  'Removing background',
  'Cleaning the cutout',
  'Finalizing wardrobe image',
] as const;

export type GarmentProcessingPhase = (typeof PROCESSING_PHASES)[number];

export function getPreferredGarmentImagePath(garment: Pick<Garment, 'image_path' | 'original_image_path' | 'processed_image_path' | 'image_processing_status'>): string | undefined {
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
