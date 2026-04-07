/**
 * Compress a video frame captured from canvas to a max-dimension JPEG.
 */
export function compressFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  maxDim = 1024,
  quality = 0.85,
): Promise<{ blob: Blob; base64: string }> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
      return reject(new Error('Video not ready'));
    }
    const scale = Math.min(maxDim / Math.max(vw, vh), 1);
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to capture frame'));
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ blob, base64: reader.result as string });
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Compress the center 70% of a video frame — crops out background clutter
 * so the AI focuses on the garment the reticle is targeting.
 */
export function compressCenterCrop(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  maxDim = 1024,
  quality = 0.85,
  cropRatio = 0.7,
): Promise<{ blob: Blob; base64: string }> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) {
      return reject(new Error('Video not ready'));
    }
    const sx = Math.round(vw * (1 - cropRatio) / 2);
    const sy = Math.round(vh * (1 - cropRatio) / 2);
    const sw = Math.round(vw * cropRatio);
    const sh = Math.round(vh * cropRatio);
    const scale = Math.min(maxDim / Math.max(sw, sh), 1);
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to capture frame'));
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ blob, base64: reader.result as string });
        };
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}
