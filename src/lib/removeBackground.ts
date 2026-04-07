/**
 * Client-side background removal using @imgly/background-removal (WASM).
 * Lazy-loaded on first call to avoid bloating the initial bundle.
 * Gracefully degrades — returns the original image on any failure.
 */

import { logger } from '@/lib/logger';

let removeModule: typeof import('@imgly/background-removal') | null = null;

async function getModule() {
  if (!removeModule) {
    removeModule = await import('@imgly/background-removal');
  }
  return removeModule;
}

/**
 * Convert a data URL to a Blob without using fetch().
 * Works reliably in Median WebView and all mobile browsers.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Remove the background from an image blob.
 * Returns a transparent PNG blob on success, or the original blob on failure.
 */
export async function removeBackground(input: Blob): Promise<Blob> {
  try {
    const mod = await getModule();
    const result = await mod.removeBackground(input, {
      model: 'isnet',
      output: { format: 'image/png', quality: 0.9 },
    });
    return result;
  } catch (err) {
    logger.warn('Background removal unavailable, using original image', err);
    return input;
  }
}

/**
 * Remove background from a base64 data URL.
 * Returns the processed PNG blob and its base64 data URL.
 * Used by the Live Scan path which works in base64.
 */
export async function removeBackgroundFromDataUrl(
  base64: string,
): Promise<{ blob: Blob; base64: string }> {
  try {
    const originalBlob = dataUrlToBlob(base64);

    const processedBlob = await removeBackground(originalBlob);

    // Convert back to data URL
    const processedBase64: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(processedBlob);
    });

    return { blob: processedBlob, base64: processedBase64 };
  } catch (err) {
    logger.warn('Background removal unavailable, using original image', err);
    // Return original — convert data URL to blob without fetch
    const blob = dataUrlToBlob(base64);
    return { blob, base64 };
  }
}
