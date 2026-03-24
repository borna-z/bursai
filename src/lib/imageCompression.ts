/**
 * Client-side image compression utility.
 * Resizes and converts images to WebP before upload to reduce bandwidth and LCP.
 */
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from '@/config/constants';

const MAX_DIMENSION = IMAGE_MAX_DIMENSION;
const QUALITY = IMAGE_QUALITY;

/**
 * Compress an image File via canvas resize + WebP conversion.
 * Returns a new File (WebP) and an object URL for preview.
 */
export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number }
): Promise<{ file: File; previewUrl: string }> {
  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? QUALITY;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Calculate new dimensions preserving aspect ratio
  let newW = width;
  let newH = height;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    newW = Math.round(width * ratio);
    newH = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(newW, newH);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.drawImage(bitmap, 0, 0, newW, newH);
  bitmap.close();

  // Try WebP first, fall back to JPEG
  let blob: Blob;
  try {
    blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  } catch {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  }

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), {
    type: blob.type,
  });

  const previewUrl = URL.createObjectURL(blob);

  return { file: compressedFile, previewUrl };
}
