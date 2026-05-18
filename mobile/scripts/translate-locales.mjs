#!/usr/bin/env node
// translate-locales — drives the translate_locale edge function to produce
// 12 mobile locale dictionaries from en.ts (source) + sv.ts (anchor).
//
// Usage:
//   node mobile/scripts/translate-locales.mjs                # all 12 locales
//   node mobile/scripts/translate-locales.mjs --locales fr,de
//   node mobile/scripts/translate-locales.mjs --only-missing # backfill mode
//   node mobile/scripts/translate-locales.mjs --dry-run      # parse only
//
// Env required (load from mobile/.env.local or process.env):
//   EXPO_PUBLIC_SUPABASE_URL  (or SUPABASE_URL)
//   TRANSLATE_LOCALE_SECRET
//
// Output: mobile/src/i18n/locales/<locale>.ts (overwrites unless --only-missing)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

export const TARGET_LOCALES = [
  'ar', 'da', 'de', 'es', 'fa', 'fi', 'fr', 'it', 'nl', 'no', 'pl', 'pt',
];

/**
 * Parse a locale file's `Record<string, string>` literal into a JS object.
 * Order-preserving. Strips // line comments + /* block comments first.
 * Accepts single OR double-quoted keys and values; handles backslash-escaped
 * quotes inside values (don\'t).
 */
export function parseLocaleFile(src) {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/^\s*\/\/.*$/gm, '');
  const out = {};
  // key: ('foo' | "foo")  : value: ('...' | "...")
  const re = /(['"])((?:\\.|(?!\1)[^\\])*)\1\s*:\s*(['"])((?:\\.|(?!\3)[^\\])*)\3\s*,?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const key = m[2].replace(/\\(['"\\])/g, '$1');
    const val = m[4].replace(/\\(['"\\])/g, '$1');
    out[key] = val;
  }
  return out;
}

export function chunkObject(obj, size) {
  const out = [];
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += size) {
    const chunk = {};
    for (const k of keys.slice(i, i + size)) chunk[k] = obj[k];
    out.push(chunk);
  }
  return out;
}

const CHUNK_SIZE = 80;

async function callEdge(envUrl, secret, payload) {
  const url = `${envUrl}/functions/v1/translate_locale`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-translate-secret': secret,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: 'non-json response', raw: text }; }
  return { status: res.status, body };
}

export async function translateOneLocale({
  targetLocale,
  source,
  sv,
  envUrl,
  secret,
  log = console.log,
  edgeCall = callEdge,
}) {
  const chunks = chunkObject(source, CHUNK_SIZE);
  const merged = {};
  const allMissing = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const svRef = {};
    for (const k of Object.keys(chunk)) if (sv[k] !== undefined) svRef[k] = sv[k];
    log(`  [${targetLocale}] chunk ${i + 1}/${chunks.length} (${Object.keys(chunk).length} keys)`);
    const { status, body } = await edgeCall(envUrl, secret, {
      target_locale: targetLocale,
      source_keys: chunk,
      sv_reference: svRef,
      chunk_index: i,
      total_chunks: chunks.length,
    });
    if (status !== 200) {
      throw new Error(`[${targetLocale}] chunk ${i}: HTTP ${status} ${JSON.stringify(body).slice(0, 200)}`);
    }
    for (const k of Object.keys(body.translations || {})) merged[k] = body.translations[k];
    if (Array.isArray(body.missing_keys)) allMissing.push(...body.missing_keys);
  }
  return { translations: merged, missing: allMissing };
}
