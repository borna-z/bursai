/**
 * i18n completeness test.
 *
 * Guards against three real bug classes:
 *   1. A literal `t('key')` call in source code where the key is missing
 *      from the English (reference) locale — renders the raw key to users.
 *   2. A non-en locale contains a key that doesn't exist in en — a dead key
 *      shipped to the bundle for no reason.
 *   3. A locale has an unexpected empty-string value — almost always a
 *      half-translated entry. Known intentional empties (install-guide
 *      composition suffixes where the sentence ends on the bold part) are
 *      allow-listed.
 *
 * Non-en locale coverage is reported but NOT hard-failed. Backfilling every
 * locale by copying the English string would ship untranslated content
 * masquerading as a translation; the runtime fallback (`en`) already handles
 * missing keys and at least makes the gap visible in the coverage report.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

import en from '@/i18n/locales/en';
import sv from '@/i18n/locales/sv';
import no from '@/i18n/locales/no';
import da from '@/i18n/locales/da';
import fi from '@/i18n/locales/fi';
import de from '@/i18n/locales/de';
import fr from '@/i18n/locales/fr';
import es from '@/i18n/locales/es';
import itLocale from '@/i18n/locales/it';
import pt from '@/i18n/locales/pt';
import nl from '@/i18n/locales/nl';
import pl from '@/i18n/locales/pl';
import ar from '@/i18n/locales/ar';
import fa from '@/i18n/locales/fa';

const LOCALES: Record<string, Record<string, string>> = {
  en, sv, no, da, fi, de, fr, es, it: itLocale, pt, nl, pl, ar, fa,
};

/**
 * Keys that are intentionally empty strings. These are install-guide
 * composition suffixes like `<pre>Tap <bold>Share</bold><post></post>`
 * where the sentence ends on the bold part and no suffix is needed.
 */
const INTENTIONAL_EMPTY_KEYS = new Set<string>([
  'landing.iphone_step2_post',
  'landing.iphone_step3_post',
  'landing.android_step3_post',
]);

const SRC_DIR = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'locales']);
const SKIP_FILE_PATTERNS = [/\.test\./, /\.spec\./, /__tests__/];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(name) && !SKIP_FILE_PATTERNS.some((re) => re.test(p))) {
      out.push(p);
    }
  }
  return out;
}

function extractUsedKeys(): Set<string> {
  const used = new Set<string>();
  // Match `t('key.name')` or `t("key.name")` — literal string argument only.
  const re = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g;
  for (const file of walk(SRC_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) used.add(m[1]);
  }
  const propKeyRe = /\b(?:labelKey|titleKey|messageKey|descKey|fallbackKey)\s*:\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g;
  for (const file of walk(SRC_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = propKeyRe.exec(src)) !== null) used.add(m[1]);
  }
  return used;
}

const usedKeys = extractUsedKeys();
const enKeys = new Set(Object.keys(LOCALES.en));

describe('i18n completeness', () => {

  it('every literal t() key in source code exists in the English locale', () => {
    const missing = [...usedKeys].filter((k) => !enKeys.has(k)).sort();
    expect(
      missing,
      missing.length
        ? `Missing from en.ts (${missing.length}):\n${missing.join('\n')}`
        : '',
    ).toEqual([]);
  });

  it('no locale has keys that are not present in English', () => {
    const orphansByLocale: Record<string, string[]> = {};
    for (const [code, dict] of Object.entries(LOCALES)) {
      if (code === 'en') continue;
      const orphans = Object.keys(dict).filter((k) => !enKeys.has(k));
      if (orphans.length) orphansByLocale[code] = orphans.sort();
    }
    const count = Object.values(orphansByLocale).reduce((n, a) => n + a.length, 0);
    expect(
      orphansByLocale,
      count
        ? `Found ${count} orphan keys across locales:\n${Object.entries(orphansByLocale)
            .map(([l, ks]) => `  ${l}: ${ks.join(', ')}`)
            .join('\n')}`
        : '',
    ).toEqual({});
  });

  it('no locale has unexpected empty-string values', () => {
    const badByLocale: Record<string, string[]> = {};
    for (const [code, dict] of Object.entries(LOCALES)) {
      const bad = Object.entries(dict)
        .filter(([k, v]) => v === '' && !INTENTIONAL_EMPTY_KEYS.has(k))
        .map(([k]) => k);
      if (bad.length) badByLocale[code] = bad.sort();
    }
    expect(badByLocale).toEqual({});
  });

  it('reports per-locale coverage against English (informational)', () => {
    const total = enKeys.size;
    const rows = Object.entries(LOCALES).map(([code, dict]) => {
      const present = Object.keys(dict).filter((k) => enKeys.has(k)).length;
      const pct = ((present / total) * 100).toFixed(1);
      return `  ${code.padEnd(3)} ${present.toString().padStart(5)}/${total}  (${pct}%)`;
    });
    console.log(`\ni18n locale coverage vs en (${total} keys):\n${rows.join('\n')}\n`);
    expect(total).toBeGreaterThan(0);
  });
});
