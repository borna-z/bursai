import { getPreferredGarmentImagePath } from '../garmentImage';

describe('garmentImage (mobile)', () => {
  it('prefers rendered image when ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'user/masked.webp',
        original_image_path: 'user/raw.webp',
        rendered_image_path: 'user/rendered.webp',
        render_status: 'ready',
      }),
    ).toBe('user/rendered.webp');
  });

  it('treats a rendered_image_path with missing render_status as ready (narrow SELECT case)', () => {
    expect(
      getPreferredGarmentImagePath({
        rendered_image_path: 'user/rendered.webp',
        image_path: 'user/masked.webp',
        original_image_path: 'user/raw.webp',
      }),
    ).toBe('user/rendered.webp');
  });

  it('does not show a pending render', () => {
    expect(
      getPreferredGarmentImagePath({
        rendered_image_path: 'user/rendered.webp',
        image_path: 'user/masked.webp',
        original_image_path: 'user/raw.webp',
        render_status: 'pending',
      }),
    ).toBe('user/masked.webp');
  });

  it('wave R-B: prefers the masked image_path over the raw original_image_path', () => {
    // Post-R-B garment — both columns set, masked must win so the wardrobe
    // shows the BG-removed cutout instead of the raw photo.
    expect(
      getPreferredGarmentImagePath({
        image_path: 'user/garment-uuid/masked.webp',
        original_image_path: 'user/garment-uuid/raw.webp',
        render_status: 'pending',
      }),
    ).toBe('user/garment-uuid/masked.webp');
  });

  it('wave R-B: falls back to original_image_path when masked sidecar is absent (legacy / segmentation unavailable)', () => {
    expect(
      getPreferredGarmentImagePath({
        original_image_path: 'user/legacy-raw.webp',
      }),
    ).toBe('user/legacy-raw.webp');
  });

  it('returns undefined when no path is available', () => {
    expect(getPreferredGarmentImagePath({})).toBeUndefined();
  });
});
