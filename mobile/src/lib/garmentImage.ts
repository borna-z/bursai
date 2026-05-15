// Mirror of `src/lib/garmentImage.ts` (web). Pick the right garment photo to
// render given `render_status` — only use the studio render when it has
// actually rendered; otherwise fall through to `image_path` (on-device-
// segmented WebP for wave R-B+ garments, AI-generated catalog image for
// pre-R-B manual-entry garments), then to the user's original photo.
//
// Wave R-B repurposed `image_path` so it now carries the masked WebP for
// every user-uploaded garment (or a copy of the raw path when segmentation
// is unavailable/failed). Preferring it over `original_image_path` is what
// makes the on-device background-removal output show up in the wardrobe.
// Pre-R-B user-uploaded rows have `image_path = NULL`, so the chain falls
// through to `original_image_path` (the raw photo) — unchanged behavior.
// Pre-R-B manual-entry rows have `image_path` set to the catalog image and
// `original_image_path = NULL`, so the chain still resolves to the catalog
// image — unchanged behavior.
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
  // M1 worker only writes `rendered_image_path` after a successful render —
  // its presence is itself the success signal. Many mobile queries (e.g.
  // `useGarmentsByIds`, GarmentCard list shapes) omit `render_status` from
  // their SELECT to keep payloads narrow; treating "status missing + rendered
  // path present" as ready preserves studio renders on those surfaces. When
  // status IS selected, the explicit non-'ready' values still skip the
  // render so an in-flight `pending`/`rendering`/`failed` row never shows a
  // stale studio image.
  if (garment.rendered_image_path) {
    const status = garment.render_status;
    if (status === undefined || status === null || status === 'ready') {
      return garment.rendered_image_path;
    }
  }
  return garment.image_path || garment.original_image_path || undefined;
}
