import { describe, expect, it } from 'vitest';
import { getGarmentProcessingMessage, getPreferredGarmentImagePath } from '@/lib/garmentImage';

describe('garmentImage', () => {
  it('prefers processed image when ready', () => {
    expect(
      getPreferredGarmentImagePath({
        image_path: 'original.jpg',
        original_image_path: 'original.jpg',
        processed_image_path: 'processed.png',
        image_processing_status: 'ready',
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

  it('returns soft fallback copy for failed processing', () => {
    expect(getGarmentProcessingMessage('failed')).toEqual({
      label: 'Original photo kept',
      tone: 'muted',
    });
  });
});
