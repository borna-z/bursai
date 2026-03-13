/**
 * useMedianCamera — Camera hook for Median.co and browser environments.
 *
 * Median does NOT expose a native camera JS bridge. Camera/gallery access
 * works via standard `<input type="file">` elements. This hook simply
 * configures and clicks the provided file input ref — preserving the
 * user-gesture context required by Android WebViews.
 */

import { useCallback } from 'react';

export interface MedianCameraResult {
  file: File;
  previewUrl: string;
}

interface UseMedianCameraOptions {
  /** Ref to a hidden `<input type="file">` used for capture/gallery */
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function useMedianCamera({ fileInputRef }: UseMedianCameraOptions = {}) {
  /** Take a photo using the device camera */
  const takePhoto = useCallback(() => {
    if (fileInputRef?.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.setAttribute('accept', 'image/*');
      fileInputRef.current.click();
    }
  }, [fileInputRef]);

  /** Pick an image from the photo library */
  const pickFromGallery = useCallback(() => {
    if (fileInputRef?.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.setAttribute('accept', 'image/*');
      fileInputRef.current.click();
    }
  }, [fileInputRef]);

  return { takePhoto, pickFromGallery };
}
