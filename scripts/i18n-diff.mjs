#!/usr/bin/env node
// i18n-diff: report keys missing in any mobile locale relative to en.ts.
//
// Usage:
//   node scripts/i18n-diff.mjs            # summary; exit 1 if any locale incomplete
//   node scripts/i18n-diff.mjs --missing  # all missing keys per locale, one per line (locale\tkey)
//   node scripts/i18n-diff.mjs --orphans  # all orphan keys per locale, one per line (locale\tkey)
//   node scripts/i18n-diff.mjs --json     # full JSON report
//
// Multi-locale extension (2026-05-18): originally en↔sv only; now walks every
// mobile/src/i18n/locales/*.ts and reports against en.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'mobile/src/i18n/locales');
const EN_PATH = resolve(LOCALES_DIR, 'en.ts');

// Line-anchored extractor: each locale entry occupies one line of the form
// `<indent>"key": "value",?` or `<indent>'key': '...',?`. Matching only at
// line-start avoids the false-positive that the older free-floating regex hit
// on en.ts line 1880, where `share.outfit.message` contains `"{name}":`
// inside its value — the unanchored matcher picked that substring up as a
// phantom `{name}` key.
function extractKeys(filePath) {
  let src = readFileSync(filePath, 'utf8');
  // Strip UTF-8 BOM if present (some Windows editors prepend it on save);
  // otherwise the first key on a BOM'd file would be preceded by
  // and the line-anchored regex wouldn't match it.
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  const keys = new Set();
  const dupes = [];
  const re = /^[ \t]*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*:/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[2];
    if (keys.has(key)) dupes.push(key);
    else keys.add(key);
  }
  return { keys, dupes };
}

const { keys: enKeys, dupes: enDupes } = extractKeys(EN_PATH);
const localeFiles = readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.ts') && f !== 'en.ts')
  .map((f) => ({ locale: basename(f, '.ts'), path: resolve(LOCALES_DIR, f) }))
  .sort((a, b) => a.locale.localeCompare(b.locale));

const report = {};
for (const { locale, path } of localeFiles) {
  const { keys, dupes } = extractKeys(path);
  const missing = [...enKeys].filter((k) => !keys.has(k)).sort();
  const orphan = [...keys].filter((k) => !enKeys.has(k)).sort();
  report[locale] = { count: keys.size, missing, orphan, dupes };
}

const flag = process.argv[2];

if (flag === '--json') {
  process.stdout.write(JSON.stringify({ en: { count: enKeys.size, dupes: enDupes }, ...report }, null, 2) + '\n');
} else if (flag === '--missing') {
  for (const [locale, r] of Object.entries(report)) {
    for (const k of r.missing) process.stdout.write(`${locale}\t${k}\n`);
  }
} else if (flag === '--orphans') {
  for (const [locale, r] of Object.entries(report)) {
    for (const k of r.orphan) process.stdout.write(`${locale}\t${k}\n`);
  }
} else {
  process.stdout.write(`en keys: ${enKeys.size}\n`);
  if (enDupes.length) {
    process.stdout.write(`duplicates in en: ${enDupes.length} (${enDupes.slice(0, 5).join(', ')}${enDupes.length > 5 ? '…' : ''})\n`);
  }
  process.stdout.write('\nlocale | keys | missing | orphan | dupes\n');
  process.stdout.write(  '-------|------|---------|--------|------\n');
  for (const [locale, r] of Object.entries(report)) {
    process.stdout.write(
      `${locale.padEnd(6)} | ${String(r.count).padEnd(4)} | ${String(r.missing.length).padEnd(7)} | ${String(r.orphan.length).padEnd(6)} | ${r.dupes.length}\n`,
    );
  }
}

const hasMissing = Object.values(report).some((r) => r.missing.length > 0);
const hasDupes = enDupes.length > 0 || Object.values(report).some((r) => r.dupes.length > 0);
if (hasMissing || hasDupes) process.exit(1);
process.exit(0);
