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
  rendered_image_path?: string | null;
  render_status?: string | null;
};

export type GarmentDisplaySource = 'rendered' | 'processed' | 'original';

export function getPreferredGarmentImageSource(garment: GarmentImageLike): GarmentDisplaySource {
  if (garment.render_status === 'ready' && garment.rendered_image_path) {
    return 'rendered';
  }

  if (garment.image_processing_status === 'ready' && garment.processed_image_path) {
    return 'processed';
  }

  return 'original';
}

export function getPreferredGarmentImagePath(garment: GarmentImageLike): string | undefined {
  // Tier 1: Gemini-rendered canonical asset
  if (garment.render_status === 'ready' && garment.rendered_image_path) {
    return garment.rendered_image_path;
  }

  // Tier 2: Background-removed cutout
  if (garment.image_processing_status === 'ready' && garment.processed_image_path) {
    return garment.processed_image_path;
  }

  // Tier 3: Original / legacy
  return garment.original_image_path || garment.image_path || undefined;
}

export function getGarmentProcessingMessage(
  status: string | null | undefined,
  renderStatus?: string | null | undefined,
  displaySource: GarmentDisplaySource = 'original',
): { label: string; tone: 'muted' | 'success' } | null {
  // Render status takes precedence when active
  if (renderStatus === 'pending' || renderStatus === 'rendering') {
    return { label: 'Rendering mannequin image in background', tone: 'muted' };
  }

  if (renderStatus === 'failed') {
    if (displaySource === 'processed') {
      return { label: 'Using cleaned cutout', tone: 'muted' };
    }

    return { label: 'Using original photo', tone: 'muted' };
  }

  if (renderStatus === 'skipped') {
    return { label: 'Using uploaded product photo', tone: 'success' };
  }

  switch (status) {
    case 'pending':
      return { label: 'Preparing image in background', tone: 'muted' };
    case 'processing':
      return { label: 'Background cleanup in progress', tone: 'muted' };
    case 'failed':
      return { label: 'Using original photo', tone: 'muted' };
    case 'ready':
      if (displaySource === 'rendered') {
        return { label: 'Using rendered mannequin image', tone: 'success' };
      }

      if (displaySource === 'processed') {
        return { label: 'Using cleaned cutout', tone: 'success' };
      }

      return null;
    default:
      return null;
  }
}

export function getGarmentProcessingPhases(): readonly GarmentProcessingPhase[] {
  return PROCESSING_PHASES;
}
