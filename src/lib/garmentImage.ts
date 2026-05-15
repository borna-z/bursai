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

  // Wave R-B repurposed `image_path` to carry the on-device-segmented WebP
  // for every user-uploaded garment (or a copy of the raw path when masking
  // is unavailable). Preferring it surfaces the BG-removed output in the
  // wardrobe; pre-R-B user rows have it NULL and fall through to the raw
  // `original_image_path` unchanged. Pre-R-B manual-entry rows (with
  // `image_path` = AI catalog image, `original_image_path` = NULL) still
  // resolve to the catalog image — unchanged behavior.
  return garment.image_path || garment.original_image_path || undefined;
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
