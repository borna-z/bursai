/**
 * Compress a video frame captured from canvas to a max-dimension JPEG.
 */
export function compressFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  maxDim = 480,
  quality = 0.5
): Promise<{ blob: Blob; base64: string }> {
  return new Promise((resolve, reject) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
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
