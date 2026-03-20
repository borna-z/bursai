import type { Garment } from '@/hooks/useGarments';

export function getPreferredGarmentImagePath(garment: Pick<Garment, 'image_path' | 'original_image_path' | 'processed_image_path' | 'image_processing_status'>): string | undefined {
  if (garment.image_processing_status === 'ready' && garment.processed_image_path) {
    return garment.processed_image_path;
  }

  return garment.original_image_path || garment.image_path || undefined;
}

export function getGarmentProcessingMessage(status: string | null | undefined): { label: string; tone: 'muted' | 'success' } | null {
  switch (status) {
    case 'pending':
      return { label: 'Upload complete', tone: 'muted' };
    case 'processing':
      return { label: 'Creating clean wardrobe image', tone: 'muted' };
    case 'ready':
      return { label: 'Ready', tone: 'success' };
    case 'failed':
      return { label: 'Using your original photo', tone: 'muted' };
    default:
      return null;
  }
}
