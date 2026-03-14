import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../median', () => ({
  isMedianApp: vi.fn(() => false),
}));

import { isMedianApp } from '../median';
import { nativeShare } from '../nativeShare';

describe('nativeShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Median share when available', async () => {
    vi.mocked(isMedianApp).mockReturnValue(true);
    const openFn = vi.fn();
    (window as any).median = { share: { open: openFn } };

    const result = await nativeShare({ url: 'https://burs.me' });
    expect(result).toBe(true);
    expect(openFn).toHaveBeenCalledWith({ url: 'https://burs.me' });

    delete (window as any).median;
  });

  it('falls back to Web Share API', async () => {
    vi.mocked(isMedianApp).mockReturnValue(false);
    const shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareFn, writable: true, configurable: true });

    const result = await nativeShare({ url: 'https://burs.me', title: 'BURS' });
    expect(result).toBe(true);
    expect(shareFn).toHaveBeenCalled();
  });

  it('falls back to clipboard when Web Share fails', async () => {
    vi.mocked(isMedianApp).mockReturnValue(false);
    Object.defineProperty(navigator, 'share', { value: undefined, writable: true, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true, configurable: true });

    const result = await nativeShare({ url: 'https://burs.me' });
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://burs.me');
  });

  it('returns false when user cancels Web Share', async () => {
    vi.mocked(isMedianApp).mockReturnValue(false);
    const abortErr = new DOMException('', 'AbortError');
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(abortErr),
      writable: true,
      configurable: true,
    });

    const result = await nativeShare({ url: 'https://burs.me' });
    expect(result).toBe(false);
  });
});
