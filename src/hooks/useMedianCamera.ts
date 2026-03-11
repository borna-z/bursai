/**
 * useMedianCamera — Median-aware camera hook.
 *
 * When running inside the Median.co native wrapper the hook uses the native
 * camera / photo-library bridge for a snappier UX.  In a regular browser it
 * falls back to the standard `<input type="file">` approach by triggering the
 * provided ref.
 */

import { useCallback } from 'react';
import { isMedianApp } from '@/lib/median';

/** Convert a base64-encoded image string to a File object. */
function base64ToFile(base64: string, filename = 'photo.jpg'): File {
  // Median returns "data:image/jpeg;base64,..." or raw base64
  const hasPrefix = base64.startsWith('data:');
  const dataUrl = hasPrefix ? base64 : `data:image/jpeg;base64,${base64}`;
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export interface MedianCameraResult {
  file: File;
  previewUrl: string;
}

interface UseMedianCameraOptions {
  /** Ref to a hidden `<input type="file">` used as fallback */
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Called when the native bridge returns an image */
  onCapture?: (result: MedianCameraResult) => void;
}

export function useMedianCamera({ fileInputRef, onCapture }: UseMedianCameraOptions = {}) {
  const isNative = isMedianApp();

  /** Take a photo using the device camera */
  const takePhoto = useCallback(async () => {
    if (isNative && window.median?.camera?.takePhoto) {
      try {
        const result = await window.median.camera.takePhoto({ quality: 90 });
        if (result?.image) {
          const file = base64ToFile(result.image, `capture-${Date.now()}.jpg`);
          const previewUrl = URL.createObjectURL(file);
          onCapture?.({ file, previewUrl });
          return { file, previewUrl };
        }
      } catch {
        // Fall through to input fallback
      }
    }
    // Fallback: trigger file input with camera capture
    if (fileInputRef?.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
    return null;
  }, [isNative, fileInputRef, onCapture]);

  /** Pick an image from the photo library */
  const pickFromGallery = useCallback(async () => {
    if (isNative && window.median?.camera?.openPhotoLibrary) {
      try {
        const result = await window.median.camera.openPhotoLibrary();
        if (result?.image) {
          const file = base64ToFile(result.image, `gallery-${Date.now()}.jpg`);
          const previewUrl = URL.createObjectURL(file);
          onCapture?.({ file, previewUrl });
          return { file, previewUrl };
        }
      } catch {
        // Fall through to input fallback
      }
    }
    // Fallback: trigger file input without capture (opens gallery)
    if (fileInputRef?.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
    return null;
  }, [isNative, fileInputRef, onCapture]);

  return { isNative, takePhoto, pickFromGallery };
}
