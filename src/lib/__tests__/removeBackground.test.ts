import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn((blob: Blob) => Promise.resolve(blob)),
}));

describe('removeBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the original blob when the module throws on import', async () => {
    vi.doMock('@imgly/background-removal', () => {
      throw new Error('WASM not supported');
    });

    const { removeBackground } = await import('../removeBackground');
    const input = new Blob(['test-data'], { type: 'image/jpeg' });
    const result = await removeBackground(input);
    expect(result).toBe(input);
  });

  it('returns a blob on success', async () => {
    vi.doMock('@imgly/background-removal', () => ({
      removeBackground: vi.fn((blob: Blob) => Promise.resolve(blob)),
    }));

    const { removeBackground } = await import('../removeBackground');
    const input = new Blob(['test-data'], { type: 'image/jpeg' });
    const result = await removeBackground(input);
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns the original base64 when processing fails', async () => {
    vi.doMock('@imgly/background-removal', () => ({
      removeBackground: vi.fn(() => Promise.reject(new Error('Processing failed'))),
    }));

    const { removeBackgroundFromDataUrl } = await import('../removeBackground');
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB';
    const result = await removeBackgroundFromDataUrl(dataUrl);
    expect(result.base64).toBe(dataUrl);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('returns a blob and base64 string on success', async () => {
    vi.doMock('@imgly/background-removal', () => ({
      removeBackground: vi.fn((blob: Blob) => Promise.resolve(blob)),
    }));

    const mockBase64Result = 'data:image/png;base64,abc123';
    const MockFileReader = vi.fn(function (this: any) {
      this.result = mockBase64Result;
      this.onloadend = null;
      this.onerror = null;
      this.readAsDataURL = vi.fn(() => {
        Promise.resolve().then(() => this.onloadend?.());
      });
    });
    vi.stubGlobal('FileReader', MockFileReader);

    const { removeBackgroundFromDataUrl } = await import('../removeBackground');
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgAB';
    const result = await removeBackgroundFromDataUrl(dataUrl);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(typeof result.base64).toBe('string');
  });
});
