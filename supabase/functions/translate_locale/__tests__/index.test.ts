import { describe, expect, it, beforeEach } from 'vitest';
import { handleRequest } from '../index';

const okSecret = 'test-secret';

beforeEach(() => {
  (globalThis as Record<string, unknown>).__TRANSLATE_LOCALE_SECRET__ = okSecret;
});

function makeReq(body: unknown, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has('x-translate-secret')) headers.set('x-translate-secret', okSecret);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Request('https://example/translate_locale', {
    method: 'POST',
    body: JSON.stringify(body),
    ...init,
    headers,
  });
}

describe('translate_locale — request gating', () => {
  it('OPTIONS preflight returns CORS headers', async () => {
    const res = await handleRequest(new Request('https://example', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    // Header lookup is case-insensitive; the shared CORS_HEADERS uses title case.
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('missing secret → 401', async () => {
    const res = await handleRequest(
      makeReq(
        { target_locale: 'fr', source_keys: { a: 'A' }, sv_reference: { a: 'A' }, chunk_index: 0, total_chunks: 1 },
        { headers: { 'x-translate-secret': 'wrong' } },
      ),
    );
    expect(res.status).toBe(401);
  });

  it('>200 keys per request → 413 with cost-cap error', async () => {
    const tooMany: Record<string, string> = {};
    for (let i = 0; i < 201; i++) tooMany['k' + i] = 'v' + i;
    const res = await handleRequest(
      makeReq({ target_locale: 'fr', source_keys: tooMany, sv_reference: {}, chunk_index: 0, total_chunks: 1 }),
    );
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/cost cap/i);
  });

  it('unknown target_locale → 400', async () => {
    const res = await handleRequest(
      makeReq({ target_locale: 'xx', source_keys: { a: 'A' }, sv_reference: {}, chunk_index: 0, total_chunks: 1 }),
    );
    expect(res.status).toBe(400);
  });
});
