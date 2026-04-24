import { describe, expect, it } from 'vitest';
import { getGarmentProcessingMessage, getPreferredGarmentImagePath, getPreferredGarmentImageSource } from '@/lib/garmentImage';

describe('garmentImage', () => {
  it('prefers rendered image when ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        rendered_image_path: 'rendered.png',
        render_status: 'ready',
      } as never),
    ).toBe('rendered.png');
  });

  it('falls back to the original image when render is still pending', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        rendered_image_path: null,
        render_status: 'pending',
      } as never),
    ).toBe('original.jpg');
  });

  it('prefers the original image when no studio render is requested', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        render_status: 'none',
      } as never),
    ).toBe('original.jpg');
  });

  it('falls back to legacy image_path when nothing else available', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'legacy.jpg',
      } as never),
    ).toBe('legacy.jpg');
  });

  it('shows render message when render is pending', () => {
    expect(getGarmentProcessingMessage('pending')).toEqual({
      label: 'Studio-quality image is processing in the background',
      tone: 'muted',
    });
  });

  it('shows render message when rendering', () => {
    expect(getGarmentProcessingMessage('rendering')).toEqual({
      label: 'Studio-quality image is processing in the background',
      tone: 'muted',
    });
  });

  it('shows neutral fallback copy when render fails', () => {
    expect(getGarmentProcessingMessage('failed')).toEqual({
      label: 'Using original photo',
      tone: 'muted',
    });
  });

  it('returns null when render is intentionally skipped', () => {
    expect(getGarmentProcessingMessage('skipped')).toBeNull();
  });

  it('returns null when render is none and the original is displayed', () => {
    expect(getGarmentProcessingMessage('none')).toBeNull();
  });

  it('reports rendered as the display source when rendered asset is active', () => {
    expect(
      getPreferredGarmentImageSource({
        render_status: 'ready',
        rendered_image_path: 'rendered.png',
      } as never),
    ).toBe('rendered');
  });

  it('returns truthful rendered-source copy when rendered asset is visible', () => {
    expect(getGarmentProcessingMessage('ready', 'rendered')).toEqual({
      label: 'Using studio-quality image',
      tone: 'success',
    });
  });
});
