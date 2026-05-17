// Shared JWT validation helper — smoke tests.
//
// Mocks @supabase/supabase-js so we don't hit the network. Stubs
// `globalThis.Deno` so the helper's `typeof Deno !== "undefined"`
// branch returns the env values we want.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: { getUser: mockGetUser },
}));

vi.mock('https://esm.sh/@supabase/supabase-js@2.49.4', () => ({
  createClient: mockCreateClient,
}));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Vary': 'Origin',
};

function stubDenoEnv(values: Record<string, string | undefined>): void {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno = {
    env: { get: (k: string) => values[k] },
  };
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockCreateClient.mockClear();
  stubDenoEnv({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon',
  });
});

afterEach(() => {
  // deno-lint-ignore no-explicit-any
  delete (globalThis as any).Deno;
});

describe('authenticate', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', { method: 'POST' });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(401);
    const body = await result.response.json();
    expect(body).toEqual({ error: 'Missing authorization header' });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no token after Bearer prefix', async () => {
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' },
    });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when Supabase env vars are missing', async () => {
    stubDenoEnv({});
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer abc' },
    });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(500);
    expect(await result.response.json()).toEqual({ error: 'Supabase not configured' });
  });

  it('returns 401 when getUser fails (invalid token)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid token' } });
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-jwt' },
    });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGetUser).toHaveBeenCalledWith('bad-jwt');
  });

  it('returns the verified user, token, and bound userClient on success', async () => {
    const user = { id: 'user-1', email: 'u@b.test' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer good-jwt' },
    });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.auth.user).toEqual(user);
    expect(result.auth.token).toBe('good-jwt');
    expect(result.auth.userClient).toBeDefined();
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon',
      { global: { headers: { Authorization: 'Bearer good-jwt' } } },
    );
    expect(mockGetUser).toHaveBeenCalledWith('good-jwt');
  });

  it('accepts the case-insensitive bearer prefix (handles `bearer xxx`)', async () => {
    const user = { id: 'user-2' };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const { authenticate } = await import('../auth');
    const req = new Request('https://x.test/fn', {
      method: 'POST',
      headers: { Authorization: 'bearer lowercased' },
    });
    const result = await authenticate(req, corsHeaders);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.auth.token).toBe('lowercased');
  });
});
