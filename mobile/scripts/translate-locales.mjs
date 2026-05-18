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
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * Tiny .env.local loader. The docstring at the top of this script says
 * "load from mobile/.env.local or process.env" — historically that meant
 * `set -a; source mobile/.env.local; set +a` from bash, which silently
 * does nothing in PowerShell on Windows (the documented dev environment).
 * Auto-loading the file here removes the platform-specific incantation
 * from the per-developer workflow. Lines starting with `#` and blank
 * lines are skipped; values are NOT shell-expanded (so `$FOO` stays
 * literal). Only sets variables not already present in process.env so
 * caller-supplied env wins.
 */
function loadEnvLocal() {
  const envPath = resolve(REPO_ROOT, 'mobile/.env.local');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    // Strip a single layer of surrounding quotes (env files often quote).
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

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
    out[m[2]] = unescapeStr(m[4]);
  }
  return out;
}

// Unescape the JS string-literal escapes we emit via JSON.stringify:
// \n, \r, \t, \", \\, \\u00XX, etc. Use JSON.parse with a forced
// double-quote wrap; falls back to a basic single-quote replacement
// for keys/values from the older hand-rolled renderer (single-quote
// wrap with \' escaped).
function unescapeStr(raw) {
  try {
    return JSON.parse('"' + raw.replace(/\\'/g, "'") + '"');
  } catch {
    // Last-resort: handle the legacy \' \" \\ escapes only.
    return raw.replace(/\\(['"\\])/g, '$1');
  }
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
  // Retry on transport-level errors (ECONNRESET, ETIMEDOUT, etc.). HTTP
  // status errors (502, 413, …) flow through to the caller; only thrown
  // failures hit this retry loop. 3 attempts with linear 2s backoff.
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
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
    } catch (err) {
      lastErr = err;
      const backoffMs = 2000 * (attempt + 1);
      console.log(`    fetch failed (attempt ${attempt + 1}/3): ${err?.cause?.code || err?.code || err?.message || err}; retrying in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  // Exhausted retries — return a synthetic 599 so the split-retry layer
  // sees it as a transient and splits the chunk further (eventually
  // falling back to English passthrough at min chunk size).
  return { status: 599, body: { error: `fetch failed after retries: ${lastErr?.cause?.code || lastErr?.message || lastErr}` } };
}

export function renderLocaleFile(locale, dict, opts = {}) {
  const { sourceSha = 'unknown' } = opts;
  const header = `// Auto-generated by mobile/scripts/translate-locales.mjs (${new Date().toISOString().slice(0, 10)}).
// Source: mobile/src/i18n/locales/en.ts (hash ${sourceSha}).
// Voice anchor: mobile/src/i18n/locales/sv.ts.
//
// To regenerate after en.ts grows:
//   node mobile/scripts/translate-locales.mjs --locales ${locale} --only-missing
//
// Append-only convention applies post-generation — never reorder keys.

export const ${locale}: Record<string, string> = {
`;
  const lines = [];
  for (const k of Object.keys(dict)) {
    const v = dict[k];
    // JSON.stringify produces a fully-escaped JS string literal in double
    // quotes (escapes \\, \", \n, \r, \t, control chars). For TS this is
    // valid as-is, so we can use it verbatim for the value. Picking the
    // wrap quote conditionally would mean re-escaping by hand; JSON's
    // canonical form is simpler and correct under every input including
    // newlines (which the old hand-rolled escaper missed — broke it.ts +
    // pt.ts on the first generation run when Gemini returned a literal
    // newline inside an importFromLink.placeholder translation).
    const safeKey = JSON.stringify(k);
    const safeVal = JSON.stringify(v);
    lines.push(`  ${safeKey}: ${safeVal},`);
  }
  return header + lines.join('\n') + '\n};\n';
}

/**
 * Translate one chunk. On TRANSIENT non-200 (typically Gemini truncation at
 * 502 on long-string locales like ar/fa, or 599 from the network-retry
 * synthetic-status), recursively splits the chunk in halves. Stops splitting
 * at MIN_CHUNK_SIZE — any chunk still failing at that size falls back to
 * English passthrough so the locale completes instead of crashing the run.
 *
 * NON-TRANSIENT statuses (401/403/400/404/405/413/422) throw immediately:
 * those mean the operator has a config problem (bad secret, stale function,
 * unsupported locale, cost-cap mismatch), and splitting silently fills the
 * locale file with English overwriting prior real translations. Loud failure
 * is the correct outcome.
 * — Codex P2 on PR #887.
 */
const MIN_CHUNK_SIZE = 10;
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 599]);

async function translateChunkWithSplit({
  targetLocale, chunk, sv, envUrl, secret, edgeCall, log, depth = 0, chunkLabel,
}) {
  const svRef = {};
  for (const k of Object.keys(chunk)) if (sv[k] !== undefined) svRef[k] = sv[k];
  const { status, body } = await edgeCall(envUrl, secret, {
    target_locale: targetLocale,
    source_keys: chunk,
    sv_reference: svRef,
    chunk_index: 0,
    total_chunks: 1,
  });
  if (status === 200) {
    return {
      translations: body.translations || {},
      missing: body.missing_keys || [],
      passthrough: body.passthrough_keys || [],
    };
  }
  if (!TRANSIENT_STATUSES.has(status)) {
    throw new Error(
      `[${targetLocale}] ${chunkLabel}: non-transient HTTP ${status} — aborting to avoid overwriting prior translations with English passthrough. ` +
      `Body: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  const keys = Object.keys(chunk);
  if (keys.length <= MIN_CHUNK_SIZE) {
    log(`  ${' '.repeat(depth * 2)}[${targetLocale}] ${chunkLabel} (${keys.length} keys) failed at min split — falling back to en for these keys: HTTP ${status}`);
    const passthroughDict = {};
    for (const k of keys) passthroughDict[k] = chunk[k];
    return { translations: passthroughDict, missing: keys, passthrough: [] };
  }
  const half = Math.ceil(keys.length / 2);
  const left = {}; const right = {};
  for (let i = 0; i < keys.length; i++) (i < half ? left : right)[keys[i]] = chunk[keys[i]];
  log(`  ${' '.repeat(depth * 2)}[${targetLocale}] ${chunkLabel} split: ${keys.length} → ${half} + ${keys.length - half} (HTTP ${status})`);
  const a = await translateChunkWithSplit({ targetLocale, chunk: left, sv, envUrl, secret, edgeCall, log, depth: depth + 1, chunkLabel: chunkLabel + '.L' });
  const b = await translateChunkWithSplit({ targetLocale, chunk: right, sv, envUrl, secret, edgeCall, log, depth: depth + 1, chunkLabel: chunkLabel + '.R' });
  return {
    translations: { ...a.translations, ...b.translations },
    missing: [...a.missing, ...b.missing],
    passthrough: [...(a.passthrough || []), ...(b.passthrough || [])],
  };
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
  const allPassthrough = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    log(`  [${targetLocale}] chunk ${i + 1}/${chunks.length} (${Object.keys(chunk).length} keys)`);
    const { translations, missing, passthrough } = await translateChunkWithSplit({
      targetLocale, chunk, sv, envUrl, secret, edgeCall, log,
      chunkLabel: `chunk ${i + 1}/${chunks.length}`,
    });
    for (const k of Object.keys(translations)) merged[k] = translations[k];
    allMissing.push(...missing);
    allPassthrough.push(...(passthrough || []));
  }
  // Backfill any source key the model dropped (returned in missing_keys or
  // simply absent) with the English passthrough. Without this, the renderer
  // emits a smaller file than en.ts and the i18n-diff CI gate flags drift.
  // Empty-string values trigger this path most often: Gemini skips them.
  for (const k of Object.keys(source)) {
    if (!(k in merged)) merged[k] = source[k];
  }
  return { translations: merged, missing: allMissing, passthrough: allPassthrough };
}

async function main() {
  loadEnvLocal();
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const onlyMissing = argv.includes('--only-missing');
  let targets = TARGET_LOCALES;
  const localesIdx = argv.findIndex((a) => a === '--locales' || a.startsWith('--locales='));
  if (localesIdx !== -1) {
    const arg = argv[localesIdx];
    const csv = arg.includes('=') ? arg.split('=')[1] : argv[localesIdx + 1];
    targets = (csv || '').split(',').filter((x) => TARGET_LOCALES.includes(x));
    if (targets.length === 0) {
      console.error(`No valid locales in --locales arg. Valid: ${TARGET_LOCALES.join(', ')}`);
      process.exit(2);
    }
  }

  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const secret = process.env.TRANSLATE_LOCALE_SECRET;
  if (!dryRun && (!envUrl || !secret)) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or TRANSLATE_LOCALE_SECRET');
    process.exit(2);
  }

  const enSrc = readFileSync(resolve(REPO_ROOT, 'mobile/src/i18n/locales/en.ts'), 'utf8');
  const svSrc = readFileSync(resolve(REPO_ROOT, 'mobile/src/i18n/locales/sv.ts'), 'utf8');
  const en = parseLocaleFile(enSrc);
  const sv = parseLocaleFile(svSrc);
  console.log(`Source: en (${Object.keys(en).length} keys) + sv anchor (${Object.keys(sv).length} keys)`);
  console.log(`Targets: ${targets.join(', ')}`);

  const { createHash } = await import('node:crypto');
  const sourceSha = createHash('sha1').update(enSrc).digest('hex').slice(0, 7);

  if (dryRun) {
    console.log('Dry run — no translation calls; exit.');
    return;
  }

  for (const target of targets) {
    console.log(`\n=== ${target} ===`);
    const outPath = resolve(REPO_ROOT, `mobile/src/i18n/locales/${target}.ts`);
    let source = en;
    if (onlyMissing && existsSync(outPath)) {
      const prev = parseLocaleFile(readFileSync(outPath, 'utf8'));
      source = Object.fromEntries(Object.entries(en).filter(([k]) => !(k in prev)));
      console.log(`--only-missing: ${Object.keys(source).length} of ${Object.keys(en).length} en keys to translate`);
      if (Object.keys(source).length === 0) {
        console.log('  nothing to do; skipping.');
        continue;
      }
    }
    const { translations, missing, passthrough } = await translateOneLocale({
      targetLocale: target,
      source,
      sv,
      envUrl,
      secret,
    });

    let final = translations;
    if (onlyMissing && existsSync(outPath)) {
      const prev = parseLocaleFile(readFileSync(outPath, 'utf8'));
      final = { ...prev, ...translations };
    }
    writeFileSync(outPath, renderLocaleFile(target, final, { sourceSha }), 'utf8');
    // missing = keys the model dropped (filled with en passthrough by
    //           the orchestrator's backfill loop).
    // passthrough = keys the model translated but mangled placeholders;
    //               the edge function substituted en for these.
    // Both end up as English in the final file — surface separately so
    // a regression in placeholder preservation doesn't hide behind
    // the existing "fell back to en" count.
    console.log(
      `  wrote ${outPath} (${Object.keys(final).length} keys, ${missing.length} dropped by model, ${passthrough.length} placeholder-mismatched — all filled with en)`,
    );
  }
}

// Run main when executed directly, not when imported by tests. Node's
// documented idiom for "is this module the entrypoint" is comparing
// import.meta.url with pathToFileURL(process.argv[1]).href — handles
// Windows backslashes, OneDrive paths, symlinks, and relative argv all
// correctly. The older suffix-match version was fragile on each of those.
const runDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();
if (runDirectly) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
