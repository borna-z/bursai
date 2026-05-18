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
