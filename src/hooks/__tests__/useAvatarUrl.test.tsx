import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { createSignedUrlMock } = vi.hoisted(() => ({
  createSignedUrlMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: createSignedUrlMock,
      })),
    },
  },
}));

import { useAvatarUrl } from '../useAvatarUrl';

describe('useAvatarUrl', () => {
  beforeEach(() => {
    createSignedUrlMock.mockReset();
  });

  it('returns null when no avatarPath provided', () => {
    const { result } = renderHook(() => useAvatarUrl(null));
    expect(result.current).toBeNull();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it('resolves to a signed URL on success', async () => {
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
    const { result } = renderHook(() => useAvatarUrl('user-1/avatar.png'));
    await waitFor(() => expect(result.current).toBe('https://signed/url'));
    expect(createSignedUrlMock).toHaveBeenCalledWith('user-1/avatar.png', 3600);
  });

  it('keeps url null when supabase returns an error', async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: new Error('boom') });
    const { result } = renderHook(() => useAvatarUrl('user-1/avatar.png'));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });

  it('refetches when avatarPath changes', async () => {
    createSignedUrlMock.mockResolvedValueOnce({ data: { signedUrl: 'a' }, error: null });
    createSignedUrlMock.mockResolvedValueOnce({ data: { signedUrl: 'b' }, error: null });
    const { result, rerender } = renderHook(({ p }) => useAvatarUrl(p), {
      initialProps: { p: 'one' },
    });
    await waitFor(() => expect(result.current).toBe('a'));
    rerender({ p: 'two' });
    await waitFor(() => expect(result.current).toBe('b'));
    expect(createSignedUrlMock).toHaveBeenCalledTimes(2);
  });
});
