#!/usr/bin/env node
// i18n-diff: report keys missing in either direction between en.ts and sv.ts.
//
// Usage:
//   node scripts/i18n-diff.mjs            # human-readable summary; exit 1 if sv missing keys
//   node scripts/i18n-diff.mjs --missing  # print missing-in-sv keys, one per line
//   node scripts/i18n-diff.mjs --orphans  # print sv-only keys, one per line
//   node scripts/i18n-diff.mjs --json     # JSON: {missingInSv:[],orphanInSv:[]}
//
// Strategy: the locale files export `Record<string, string>` literals using a
// flat dot-namespaced key string. We don't pull in tsx — we lex the source
// file looking for object-literal keys at the top level. This is robust to
// comments, line continuations, and template-literal values.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const EN_PATH = resolve(ROOT, 'mobile/src/i18n/locales/en.ts');
const SV_PATH = resolve(ROOT, 'mobile/src/i18n/locales/sv.ts');

/**
 * Extract all top-level keys from a locale file.
 *
 * Locale files export an object literal of the shape:
 *   export const en: Record<string, string> = {
 *     'foo.bar': 'value',
 *     "baz.qux": `multi
 *       line value`,
 *     'with.template': 'hello {name}',
 *   };
 *
 * We strip block + line comments first, then walk the source and capture
 * each quoted key that appears immediately before a colon. This handles
 * single, double, and backtick keys (though backtick keys aren't actually
 * used in this repo).
 */
function extractKeys(filePath) {
  let src = readFileSync(filePath, 'utf8');
  // Strip block comments
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Strip line comments (rough; we don't care about losing string content)
  src = src.replace(/^\s*\/\/.*$/gm, '');

  const keys = new Set();
  const dupes = [];
  // Match a quoted string immediately followed by optional whitespace + `:`
  // The string can be 'single', "double", or `backtick` quoted. We don't
  // attempt to escape — these locale files don't use embedded quotes in keys.
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*:/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[2];
    if (keys.has(key)) {
      dupes.push(key);
    } else {
      keys.add(key);
    }
  }
  return { keys, dupes };
}

const { keys: enKeys, dupes: enDupes } = extractKeys(EN_PATH);
const { keys: svKeys, dupes: svDupes } = extractKeys(SV_PATH);

const missingInSv = [...enKeys].filter((k) => !svKeys.has(k)).sort();
const orphanInSv = [...svKeys].filter((k) => !enKeys.has(k)).sort();

const flag = process.argv[2];

if (flag === '--json') {
  process.stdout.write(
    JSON.stringify({ missingInSv, orphanInSv, enDupes, svDupes }, null, 2) + '\n',
  );
} else if (flag === '--missing') {
  for (const k of missingInSv) process.stdout.write(k + '\n');
} else if (flag === '--orphans') {
  for (const k of orphanInSv) process.stdout.write(k + '\n');
} else {
  process.stdout.write(`en keys: ${enKeys.size}\n`);
  process.stdout.write(`sv keys: ${svKeys.size}\n`);
  process.stdout.write(`missing in sv: ${missingInSv.length}\n`);
  process.stdout.write(`orphan in sv (sv-only): ${orphanInSv.length}\n`);
  process.stdout.write(`duplicates in en: ${enDupes.length}\n`);
  process.stdout.write(`duplicates in sv: ${svDupes.length}\n`);
  if (enDupes.length) {
    process.stdout.write('\n--- duplicates in en (first 10) ---\n');
    for (const k of enDupes.slice(0, 10)) process.stdout.write(k + '\n');
  }
  if (svDupes.length) {
    process.stdout.write('\n--- duplicates in sv (first 10) ---\n');
    for (const k of svDupes.slice(0, 10)) process.stdout.write(k + '\n');
  }
  if (missingInSv.length) {
    process.stdout.write('\n--- missing in sv (first 20) ---\n');
    for (const k of missingInSv.slice(0, 20)) process.stdout.write(k + '\n');
    if (missingInSv.length > 20) {
      process.stdout.write(`... and ${missingInSv.length - 20} more\n`);
    }
  }
  if (orphanInSv.length) {
    process.stdout.write('\n--- orphan in sv (first 20) ---\n');
    for (const k of orphanInSv.slice(0, 20)) process.stdout.write(k + '\n');
    if (orphanInSv.length > 20) {
      process.stdout.write(`... and ${orphanInSv.length - 20} more\n`);
    }
  }
}

// Treat both untranslated keys and duplicate-key drift as failures so a
// stale rebase or an unintentional double-add can't sneak through CI.
if (missingInSv.length > 0 || enDupes.length > 0 || svDupes.length > 0) {
  process.exit(1);
}
process.exit(0);
