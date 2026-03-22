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
): { label: string; tone: 'muted' | 'success' } | null {
  // Render status takes precedence when active
  if (renderStatus === 'pending' || renderStatus === 'rendering') {
    return { label: 'Enhancing your photo in the background…', tone: 'muted' };
  }

  // Render failed but processing was intentionally skipped (Add Photo pilot)
  if (renderStatus === 'failed' && status === 'failed') {
    return { label: 'Original photo kept', tone: 'muted' };
  }

  switch (status) {
    case 'pending':
      return { label: 'Using original photo for now', tone: 'muted' };
    case 'processing':
      return { label: 'Background cleanup in progress', tone: 'muted' };
    case 'failed':
      // If render is ready, the rendered image is already shown — no badge needed
      if (renderStatus === 'ready') return null;
      return { label: 'Original photo kept', tone: 'muted' };
    default:
      return null;
  }
}

export function getGarmentProcessingPhases(): readonly GarmentProcessingPhase[] {
  return PROCESSING_PHASES;
}
