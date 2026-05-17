import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleRequest } from '../index';
import * as bursAi from '../../_shared/burs-ai';

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

describe('translate_locale — Gemini call', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__TRANSLATE_LOCALE_SECRET__ = okSecret;
    vi.restoreAllMocks();
  });

  it('returns translated keys when Gemini responds well', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: JSON.stringify({
        translations: {
          'auth.signIn.cta': 'Se connecter',
          'auth.signUp.cta': "S'inscrire",
        },
      }),
      model_used: 'gemini-2.5-flash',
      from_cache: false,
    });

    const res = await handleRequest(
      makeReq({
        target_locale: 'fr',
        source_keys: { 'auth.signIn.cta': 'Sign in', 'auth.signUp.cta': 'Sign up' },
        sv_reference: { 'auth.signIn.cta': 'Logga in', 'auth.signUp.cta': 'Registrera' },
        chunk_index: 0,
        total_chunks: 1,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.target_locale).toBe('fr');
    expect(body.translations['auth.signIn.cta']).toBe('Se connecter');
    expect(body.translations['auth.signUp.cta']).toBe("S'inscrire");
    expect(body.missing_keys).toEqual([]);
  });

  it('flags dropped keys as missing without failing the whole chunk', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: JSON.stringify({ translations: { a: 'A_fr' } }),
      model_used: 'gemini-2.5-flash',
      from_cache: false,
    });

    const res = await handleRequest(
      makeReq({
        target_locale: 'fr',
        source_keys: { a: 'A', b: 'B' },
        sv_reference: { a: 'A_sv', b: 'B_sv' },
        chunk_index: 0,
        total_chunks: 1,
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.missing_keys).toEqual(['b']);
    expect(body.translations).toEqual({ a: 'A_fr' });
  });

  it('falls back to English passthrough when placeholders mangled', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: JSON.stringify({ translations: { greet: 'Bonjour {nom}' } }),
      model_used: 'gemini-2.5-flash',
      from_cache: false,
    });

    const res = await handleRequest(
      makeReq({
        target_locale: 'fr',
        source_keys: { greet: 'Hello {name}' },
        sv_reference: { greet: 'Hej {name}' },
        chunk_index: 0,
        total_chunks: 1,
      }),
    );
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.translations.greet).toBe('Hello {name}');
  });

  it('returns 502 when Gemini emits unparseable JSON', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: 'not json at all',
      model_used: 'gemini-2.5-flash',
      from_cache: false,
    });

    const res = await handleRequest(
      makeReq({
        target_locale: 'fr',
        source_keys: { a: 'A' },
        sv_reference: { a: 'A_sv' },
        chunk_index: 0,
        total_chunks: 1,
      }),
    );
    expect(res.status).toBe(502);
  });
});
