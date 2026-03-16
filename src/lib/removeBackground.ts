/**
 * Client-side background removal using @imgly/background-removal (WASM).
 * Lazy-loaded on first call to avoid bloating the initial bundle.
 * Gracefully degrades — returns the original image on any failure.
 */

let removeModule: typeof import('@imgly/background-removal') | null = null;

async function getModule() {
  if (!removeModule) {
    removeModule = await import('@imgly/background-removal');
  }
  return removeModule;
}

/**
 * Remove the background from an image blob.
 * Returns a transparent PNG blob on success, or the original blob on failure.
 */
export async function removeBackground(input: Blob): Promise<Blob> {
  try {
    const mod = await getModule();
    const result = await mod.removeBackground(input, {
      model: 'small',
      output: { format: 'image/png', quality: 0.9 },
    });
    return result;
  } catch (err) {
    console.warn('Background removal unavailable, using original image', err);
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
    // Convert data URL to blob
    const response = await fetch(base64);
    const originalBlob = await response.blob();

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
    console.warn('Background removal unavailable, using original image', err);
    // Return original — convert data URL back to blob
    const response = await fetch(base64);
    const blob = await response.blob();
    return { blob, base64 };
  }
}
