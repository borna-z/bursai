// translate-locales orchestrator smoke tests.
// Run with: node --test mobile/scripts/__tests__/translate-locales.test.mjs
//
// node:test is built-in (no devDep), runs the .mjs orchestrator directly
// without compile step. The orchestrator never ships into the app bundle,
// so we don't need it under Jest's coverage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocaleFile } from '../translate-locales.mjs';

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

test('parses real mobile/src/i18n/locales/en.ts', async () => {
  const { readFileSync } = await import('node:fs');
  const path = new URL('../../src/i18n/locales/en.ts', import.meta.url);
  const src = readFileSync(path, 'utf8');
  const obj = parseLocaleFile(src);
  const keys = Object.keys(obj);
  assert.ok(keys.length >= 1500, `expected >=1500 keys, got ${keys.length}`);
  assert.equal(typeof obj['splash.wordmark'], 'string');
});
