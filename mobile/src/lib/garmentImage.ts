// Mirror of `src/lib/garmentImage.ts` (web). Pick the right garment photo to
// render given `render_status` — only use the studio render when it has
// actually rendered; otherwise fall through to the user's original photo, then
// to the AI-generated catalog image (`image_path`, written by
// `generate_garment_images` for manual-entry garments).
//
// Keeping this in sync with web means the same garment renders the same image
// across surfaces, and a `pending`/`rendering` row never shows a stale render.

export type GarmentImageLike = {
  image_path?: string | null;
  original_image_path?: string | null;
  rendered_image_path?: string | null;
  render_status?: string | null;
};

export function getPreferredGarmentImagePath(garment: GarmentImageLike): string | undefined {
  if (garment.render_status === 'ready' && garment.rendered_image_path) {
    return garment.rendered_image_path;
  }
  return garment.original_image_path || garment.image_path || undefined;
}
