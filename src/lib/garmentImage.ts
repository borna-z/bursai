const PROCESSING_PHASES = [
  'Preparing your garment',
  'Saving the photo',
  'Reviewing details',
  'Finalizing wardrobe image',
] as const;

export type GarmentProcessingPhase = (typeof PROCESSING_PHASES)[number];

type GarmentImageLike = {
  image_path?: string | null;
  original_image_path?: string | null;
  rendered_image_path?: string | null;
  render_status?: string | null;
};

export type GarmentDisplaySource = 'rendered' | 'original';

export function getPreferredGarmentImageSource(garment: GarmentImageLike): GarmentDisplaySource {
  if (garment.render_status === 'ready' && garment.rendered_image_path) {
    return 'rendered';
  }

  return 'original';
}

export function getPreferredGarmentImagePath(garment: GarmentImageLike): string | undefined {
  if (garment.render_status === 'ready' && garment.rendered_image_path) {
    return garment.rendered_image_path;
  }

  return garment.original_image_path || garment.image_path || undefined;
}

export function getGarmentProcessingMessage(
  renderStatus?: string | null | undefined,
  displaySource: GarmentDisplaySource = 'original',
): { label: string; tone: 'muted' | 'success' } | null {
  if (renderStatus === 'pending' || renderStatus === 'rendering') {
    return { label: 'Studio-quality image is processing in the background', tone: 'muted' };
  }

  if (renderStatus === 'failed') {
    return { label: 'Using original photo', tone: 'muted' };
  }

  if (renderStatus === 'skipped') {
    return null;
  }

  if (displaySource === 'rendered') {
    return { label: 'Using studio-quality image', tone: 'success' };
  }

  return null;
}

export function getGarmentProcessingPhases(): readonly GarmentProcessingPhase[] {
  return PROCESSING_PHASES;
}
