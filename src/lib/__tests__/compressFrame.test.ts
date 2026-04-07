import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressFrame, compressCenterCrop } from '@/lib/compressFrame';

interface MockFileReaderInstance {
  result: string;
  onloadend: (() => void) | null;
  readAsDataURL: ReturnType<typeof vi.fn>;
}

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

  function stubFileReader() {
    const MockFileReader = vi.fn(function (this: MockFileReaderInstance) {
      this.result = 'data:image/jpeg;base64,aW1n';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);
  }

  it('scales canvas to fit maxDim and resolves with blob + base64', async () => {
    stubFileReader();
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
    stubFileReader();
    const { canvas, video, drawImage } = makeMocks();
    Object.defineProperty(video, 'videoWidth', { value: 320, writable: true });
    Object.defineProperty(video, 'videoHeight', { value: 240, writable: true });

    await compressFrame(canvas, video, 480);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 320, 240);
  });

  it('rejects when toBlob returns null', async () => {
    const { canvas, video } = makeMocks(null);
    await expect(compressFrame(canvas, video)).rejects.toThrow('Failed to capture frame');
  });
});

describe('compressCenterCrop', () => {
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

  it('crops center 70% of the frame and scales to maxDim', async () => {
    const MockFileReader = vi.fn(function (this: MockFileReaderInstance) {
      this.result = 'data:image/jpeg;base64,Y3JvcA==';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { canvas, video, drawImage } = makeMocks();

    const result = await compressCenterCrop(canvas, video, 480, 0.5);

    // Crop 70%: sx=288, sy=162, sw=1344, sh=756
    // Scale: min(480/1344, 1) = 0.357 → 480×270
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(270);
    // drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
    expect(drawImage).toHaveBeenCalledWith(video, 288, 162, 1344, 756, 0, 0, 480, 270);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.base64).toContain('data:image/jpeg');
  });

  it('uses new defaults of 1024 maxDim when no args passed', async () => {
    const MockFileReader = vi.fn(function (this: MockFileReaderInstance) {
      this.result = 'data:image/jpeg;base64,Y3JvcA==';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { canvas, video, drawImage } = makeMocks();

    await compressCenterCrop(canvas, video);

    // Crop 70%: sx=288, sy=162, sw=1344, sh=756
    // Scale: min(1024/1344, 1) = 0.762 → 1024×576
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(576);
    expect(drawImage).toHaveBeenCalledWith(video, 288, 162, 1344, 756, 0, 0, 1024, 576);
  });

  it('accepts custom cropRatio parameter', async () => {
    const MockFileReader = vi.fn(function (this: MockFileReaderInstance) {
      this.result = 'data:image/jpeg;base64,Y3JvcA==';
      this.onloadend = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { canvas, video, drawImage } = makeMocks();

    await compressCenterCrop(canvas, video, 1024, 0.85, 0.5);

    // Crop 50%: sx=480, sy=270, sw=960, sh=540
    // Scale: min(1024/960, 1) = 1 → 960×540
    expect(canvas.width).toBe(960);
    expect(canvas.height).toBe(540);
    expect(drawImage).toHaveBeenCalledWith(video, 480, 270, 960, 540, 0, 0, 960, 540);
  });

  it('rejects when toBlob returns null', async () => {
    const { canvas, video } = makeMocks(null);
    await expect(compressCenterCrop(canvas, video)).rejects.toThrow('Failed to capture frame');
  });
});
