// translate-locales orchestrator smoke tests.
// Run with: node --test mobile/scripts/__tests__/translate-locales.test.mjs
//
// node:test is built-in (no devDep), runs the .mjs orchestrator directly
// without compile step. The orchestrator never ships into the app bundle,
// so we don't need it under Jest's coverage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLocaleFile,
  chunkObject,
  translateOneLocale,
  renderLocaleFile,
} from '../translate-locales.mjs';

test('parseLocaleFile extracts keys + values', () => {
  const src = `export const en = {
  'a.b': 'Hello',
  "c.d": 'World {name}',
  // comment
  'e.f': "Welcome",
};`;
  assert.deepEqual(parseLocaleFile(src), {
    'a.b': 'Hello',
    'c.d': 'World {name}',
    'e.f': 'Welcome',
  });
});

test('parseLocaleFile preserves insertion order', () => {
  const src = `export const en = {
  'z': 'Z',
  'a': 'A',
  'm': 'M',
};`;
  assert.deepEqual(Object.keys(parseLocaleFile(src)), ['z', 'a', 'm']);
});

test('parseLocaleFile handles escaped single quotes', () => {
  const src = `export const en = {
  'k': 'don\\'t',
};`;
  assert.deepEqual(parseLocaleFile(src), { k: "don't" });
});

test('parseLocaleFile round-trips JSON-style escapes (\\n, \\", \\\\)', () => {
  const src = `export const fr = {
  "k1": "line1\\nline2",
  "k2": "say \\"hi\\"",
  "k3": "back\\\\slash",
};`;
  const out = parseLocaleFile(src);
  assert.equal(out.k1, 'line1\nline2');
  assert.equal(out.k2, 'say "hi"');
  assert.equal(out.k3, 'back\\slash');
});

test('chunkObject handles empty input', () => {
  assert.deepEqual(chunkObject({}, 80), []);
});

test('chunkObject splits at the requested boundary, preserves order', () => {
  const obj = {};
  for (let i = 0; i < 250; i++) obj['k' + i] = 'v' + i;
  const chunks = chunkObject(obj, 80);
  assert.equal(chunks.length, 4);
  assert.equal(Object.keys(chunks[0]).length, 80);
  assert.equal(Object.keys(chunks[1]).length, 80);
  assert.equal(Object.keys(chunks[2]).length, 80);
  assert.equal(Object.keys(chunks[3]).length, 10);
  assert.equal(chunks[0]['k0'], 'v0');
  assert.equal(chunks[3]['k249'], 'v249');
});

test('translateOneLocale walks chunks sequentially and merges results', async () => {
  const source = {};
  for (let i = 0; i < 5; i++) source['k' + i] = 'v' + i;
  const sv = { k0: 'V_0' };
  const calls = [];
  const fakeEdge = async (_url, _secret, payload) => {
    calls.push(payload);
    const translations = {};
    for (const k of Object.keys(payload.source_keys)) {
      translations[k] = 'fr_' + payload.source_keys[k];
    }
    return {
      status: 200,
      body: {
        ok: true,
        target_locale: 'fr',
        translations,
        chunk_index: payload.chunk_index,
        missing_keys: [],
      },
    };
  };
  const out = await translateOneLocale({
    targetLocale: 'fr',
    source,
    sv,
    envUrl: 'http://x',
    secret: 's',
    log: () => {},
    edgeCall: fakeEdge,
  });
  assert.equal(calls.length, 1); // 5 keys, chunk size 80 → one chunk
  assert.equal(calls[0].sv_reference.k0, 'V_0');
  assert.equal(out.translations.k0, 'fr_v0');
  assert.equal(out.translations.k4, 'fr_v4');
  assert.deepEqual(out.passthrough, []);
});

test('translateOneLocale surfaces passthrough_keys from edge function', async () => {
  // Simulates edge reporting one key as placeholder-mismatched.
  const fakeEdge = async (_url, _secret, payload) => {
    const translations = {};
    for (const k of Object.keys(payload.source_keys)) {
      // Pass the source value through for keyA, model-translated for keyB.
      translations[k] = k === 'keyA' ? payload.source_keys[k] : 'fr_' + payload.source_keys[k];
    }
    return {
      status: 200,
      body: {
        ok: true,
        target_locale: 'fr',
        translations,
        chunk_index: payload.chunk_index,
        missing_keys: [],
        passthrough_keys: ['keyA'],
      },
    };
  };
  const out = await translateOneLocale({
    targetLocale: 'fr',
    source: { keyA: 'A {name}', keyB: 'B' },
    sv: {},
    envUrl: 'http://x',
    secret: 's',
    log: () => {},
    edgeCall: fakeEdge,
  });
  assert.deepEqual(out.passthrough, ['keyA']);
  assert.equal(out.translations.keyA, 'A {name}');
  assert.equal(out.translations.keyB, 'fr_B');
});

test('translateOneLocale throws on non-transient 401 instead of writing English passthrough (Codex P2)', async () => {
  const source = { a: 'A', b: 'B' };
  const fakeEdge = async () => ({ status: 401, body: { error: 'unauthorized' } });
  const { translateOneLocale } = await import('../translate-locales.mjs');
  await assert.rejects(
    () => translateOneLocale({
      targetLocale: 'fr', source, sv: {},
      envUrl: 'http://x', secret: 'bad', log: () => {}, edgeCall: fakeEdge,
    }),
    /non-transient HTTP 401/,
  );
});

test('translateOneLocale splits on transient 502, eventually falling back at min size', async () => {
  const source = {};
  for (let i = 0; i < 20; i++) source['k' + i] = 'v' + i;
  // Always-fail 502: forces split all the way down to MIN_CHUNK_SIZE (10),
  // then passthrough fires. No throw.
  const fakeEdge = async () => ({ status: 502, body: { error: 'truncation' } });
  const { translateOneLocale } = await import('../translate-locales.mjs');
  const out = await translateOneLocale({
    targetLocale: 'fr', source, sv: {},
    envUrl: 'http://x', secret: 's', log: () => {}, edgeCall: fakeEdge,
  });
  // All 20 keys passthrough to English values, all reported missing.
  assert.equal(Object.keys(out.translations).length, 20);
  assert.equal(out.translations.k0, 'v0');
  assert.equal(out.missing.length, 20);
});

test('renderLocaleFile emits valid TS module with header + insertion-order keys', () => {
  const out = renderLocaleFile('fr', {
    'nav.today': "Aujourd'hui",
    'home.title': 'Bonjour {name}',
  }, { sourceSha: 'abc1234' });
  assert.match(out, /export const fr: Record<string, string> = \{/);
  // JSON.stringify format: double-quote wrap; apostrophes don't need escaping.
  assert.match(out, /"nav\.today": "Aujourd'hui",/);
  assert.match(out, /"home\.title": "Bonjour \{name\}",/);
  assert.match(out, /Auto-generated by mobile\/scripts\/translate-locales\.mjs/);
  assert.match(out, /Source: mobile\/src\/i18n\/locales\/en\.ts \(hash abc1234\)/);
  assert.ok(out.trimEnd().endsWith('};'));
});

test('renderLocaleFile escapes embedded newlines (the bug that broke it.ts/pt.ts)', () => {
  const out = renderLocaleFile('fr', { hint: 'line one\nline two' });
  // Output must be a single physical line per key. JSON.stringify renders
  // \n as the 2-char literal backslash-n, not as an actual newline.
  assert.match(out, /"hint": "line one\\nline two",/);
});

test('renderLocaleFile escapes double quotes in values', () => {
  const out = renderLocaleFile('fr', { greet: 'say "hi"' });
  assert.match(out, /"greet": "say \\"hi\\"",/);
});

test('renderLocaleFile header includes locale-specific --only-missing regen command', () => {
  const out = renderLocaleFile('de', { a: 'A' });
  // The regenerate hint must name the same locale we just rendered, otherwise
  // a future operator following it would clobber the wrong file.
  assert.match(out, /--locales de --only-missing/);
});

test('parses real mobile/src/i18n/locales/en.ts', async () => {
  const { readFileSync } = await import('node:fs');
  const path = new URL('../../src/i18n/locales/en.ts', import.meta.url);
  const src = readFileSync(path, 'utf8');
  const obj = parseLocaleFile(src);
  const keys = Object.keys(obj);
  assert.ok(keys.length >= 1500, `expected >=1500 keys, got ${keys.length}`);
  assert.equal(typeof obj['splash.wordmark'], 'string');
});
