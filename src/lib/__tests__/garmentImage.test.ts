import { describe, expect, it } from 'vitest';
import { getGarmentProcessingMessage, getPreferredGarmentImagePath } from '@/lib/garmentImage';

describe('garmentImage', () => {
  it('prefers rendered image when ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        processed_image_path: 'processed.png',
        image_processing_status: 'ready',
        rendered_image_path: 'rendered.png',
        render_status: 'ready',
      } as never),
    ).toBe('rendered.png');
  });

  it('falls back to processed image when render not ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        processed_image_path: 'processed.png',
        image_processing_status: 'ready',
        rendered_image_path: null,
        render_status: 'pending',
      } as never),
    ).toBe('processed.png');
  });

  it('prefers processed image when ready and render is none', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        processed_image_path: 'processed.png',
        image_processing_status: 'ready',
        render_status: 'none',
      } as never),
    ).toBe('processed.png');
  });

  it('falls back to original image when processing is not ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'legacy.jpg',
        original_image_path: 'original.jpg',
        processed_image_path: 'processed.png',
        image_processing_status: 'processing',
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

  it('returns soft fallback copy for failed processing', () => {
    expect(getGarmentProcessingMessage('failed')).toEqual({
      label: 'Original photo kept',
      tone: 'muted',
    });
  });

  it('shows render message when render is pending', () => {
    expect(getGarmentProcessingMessage('ready', 'pending')).toEqual({
      label: 'Generating wardrobe image',
      tone: 'muted',
    });
  });

  it('shows render message when rendering', () => {
    expect(getGarmentProcessingMessage('ready', 'rendering')).toEqual({
      label: 'Generating wardrobe image',
      tone: 'muted',
    });
  });

  it('falls through to processing message when render is none', () => {
    expect(getGarmentProcessingMessage('pending', 'none')).toEqual({
      label: 'Using original photo for now',
      tone: 'muted',
    });
  });
});
