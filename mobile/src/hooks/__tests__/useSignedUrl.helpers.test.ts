// useSignedUrl.helpers — N7 split unit coverage.
//
// Sanity checks the cache primitives that moved out of useSignedUrl:
// `cacheKey` shape, `isFresh` TTL gating, `coerceFetchError` shape.

import {
  BUCKET,
  cacheKey,
  coerceFetchError,
  isFresh,
  TTL_MS,
} from '../useSignedUrl.helpers';

describe('useSignedUrl.helpers', () => {
  describe('cacheKey', () => {
    it('joins bucket and path with a colon', () => {
      expect(cacheKey(BUCKET, 'a/b.jpg')).toBe('garments:a/b.jpg');
    });
  });

  describe('isFresh', () => {
    it('returns false for undefined entry', () => {
      expect(isFresh(undefined)).toBe(false);
    });

    it('returns true when expiresAt is in the future', () => {
      expect(isFresh({ url: 'u', expiresAt: Date.now() + 60_000 })).toBe(true);
    });

    it('returns false when expiresAt is in the past', () => {
      expect(isFresh({ url: 'u', expiresAt: Date.now() - 1 })).toBe(false);
    });

    it('respects the TTL_MS constant', () => {
      // Just a smoke check — TTL_MS should be 50 minutes.
      expect(TTL_MS).toBe(50 * 60 * 1000);
    });
  });

  describe('coerceFetchError', () => {
    it('passes Error instances through', () => {
      const e = new Error('boom');
      expect(coerceFetchError(e, 'fallback')).toBe(e);
    });

    it('wraps a {message} object', () => {
      const out = coerceFetchError({ message: 'rls denied' }, 'fallback');
      expect(out).toBeInstanceOf(Error);
      expect(out.message).toContain('rls denied');
    });

    it('falls back to the provided message for null', () => {
      expect(coerceFetchError(null, 'fallback msg').message).toBe('fallback msg');
    });
  });
});
