import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressFrame } from '@/lib/compressFrame';

describe('compressFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function makeMocks(blobResult: Blob | null = new Blob(['img'], { type: 'image/jpeg' })) {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((cb: BlobCallback) => cb(blobResult)),
    } as unknown as HTMLCanvasElement;

    const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement;
    return { canvas, video, drawImage };
  }

  it('scales canvas to fit maxDim and resolves with blob + base64', async () => {
    const MockFileReader = vi.fn(function (this: any) {
      this.result = 'data:image/jpeg;base64,aW1n';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { canvas, video, drawImage } = makeMocks();

    const result = await compressFrame(canvas, video, 480, 0.5);

    // Scale: min(480/1920, 1) = 0.25 → 480×270
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(270);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 480, 270);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.base64).toContain('data:image/jpeg');
  });

  it('does not upscale when video is smaller than maxDim', async () => {
    const MockFileReader = vi.fn(function (this: any) {
      this.result = 'data:image/jpeg;base64,c21hbGw=';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { canvas, video, drawImage } = makeMocks();
    (video as any).videoWidth = 320;
    (video as any).videoHeight = 240;

    await compressFrame(canvas, video, 480);

    // scale = min(480/320, 1) = 1 → no resize
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 240);
  });

  it('rejects when toBlob returns null', async () => {
    const { canvas, video } = makeMocks(null);

    await expect(compressFrame(canvas, video)).rejects.toThrow('Failed to capture frame');
  });
});
