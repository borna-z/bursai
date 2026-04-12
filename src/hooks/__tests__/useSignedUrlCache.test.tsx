import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { createSignedUrlsMock } = vi.hoisted(() => ({
  createSignedUrlsMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: createSignedUrlsMock,
      })),
    },
  },
}));

import {
  getCachedSignedUrl,
  batchGetSignedUrls,
  useCachedSignedUrl,
} from '../useSignedUrlCache';

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds = [];
}

describe('useSignedUrlCache', () => {
  beforeEach(() => {
    createSignedUrlsMock.mockReset();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  describe('getCachedSignedUrl / batch', () => {
    it('returns null when storage call errors', async () => {
      createSignedUrlsMock.mockResolvedValue({ data: null, error: new Error('boom') });
      const result = await getCachedSignedUrl(`unique-path-error-${Math.random()}`);
      expect(result).toBeNull();
    });

    it('returns a url when batch resolves', async () => {
      const path = `unique-path-success-${Math.random()}`;
      createSignedUrlsMock.mockResolvedValue({
        data: [{ signedUrl: 'https://signed/x', path }],
        error: null,
      });
      const result = await getCachedSignedUrl(path);
      expect(result).toEqual({ url: 'https://signed/x' });
    });

    it('serves the second call from cache without re-fetching', async () => {
      const path = `unique-path-cache-${Math.random()}`;
      createSignedUrlsMock.mockResolvedValue({
        data: [{ signedUrl: 'https://signed/cached', path }],
        error: null,
      });
      await getCachedSignedUrl(path);
      createSignedUrlsMock.mockClear();
      const result = await getCachedSignedUrl(path);
      expect(result).toEqual({ url: 'https://signed/cached' });
      expect(createSignedUrlsMock).not.toHaveBeenCalled();
    });

    it('batchGetSignedUrls resolves a Map of urls', async () => {
      const p1 = `batch-1-${Math.random()}`;
      const p2 = `batch-2-${Math.random()}`;
      createSignedUrlsMock.mockResolvedValue({
        data: [
          { signedUrl: 'u1', path: p1 },
          { signedUrl: 'u2', path: p2 },
        ],
        error: null,
      });
      const map = await batchGetSignedUrls([p1, p2]);
      expect(map.get(p1)).toBe('u1');
      expect(map.get(p2)).toBe('u2');
    });
  });

  describe('useCachedSignedUrl', () => {
    it('returns nulls when imagePath is undefined', () => {
      const { result } = renderHook(() => useCachedSignedUrl(undefined));
      expect(result.current.signedUrl).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('hydrates immediately from cache when present', async () => {
      const path = `hook-cache-${Math.random()}`;
      createSignedUrlsMock.mockResolvedValue({
        data: [{ signedUrl: 'https://hydrated', path }],
        error: null,
      });
      // Warm cache
      await getCachedSignedUrl(path);

      const { result } = renderHook(() => useCachedSignedUrl(path));
      await waitFor(() => expect(result.current.signedUrl).toBe('https://hydrated'));
    });
  });
});
