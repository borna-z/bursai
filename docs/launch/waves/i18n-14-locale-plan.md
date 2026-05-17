# Mobile i18n 14-locale Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ar/da/de/es/fa/fi/fr/it/nl/no/pl/pt as real translated dictionaries on mobile, alongside existing en/sv, gated by a CI drift check.

**Architecture:** New edge function `translate_locale` (Gemini via existing `callBursAI`) called by a local Node orchestrator script that chunks `mobile/src/i18n/locales/en.ts` (using `sv.ts` as a brand-voice anchor) and writes one `<lang>.ts` per locale. Then wire the 14 locales into `mobile/src/lib/i18n.ts` + `LanguageStep`. Then extend `scripts/i18n-diff.mjs` to all 14 and add a GitHub Actions job.

**Tech Stack:** Deno (edge function), vitest, Node (orchestrator), Gemini 2.5 Flash via OpenAI-compatible endpoint, TypeScript, React Native, GitHub Actions.

---

## Pre-flight

Branch: `feat/mobile-i18n-14-locale-expansion` (already created off `origin/main`, spec at `docs/launch/waves/i18n-14-locale-expansion.md` already committed as `1f21615c`).

**Working directory:** `C:/Users/borna/OneDrive/Desktop/BZ/Burs/bursai-working`

**Required env vars** (set in Supabase project secrets before deploy, AND in `mobile/.env.local` for the orchestrator):
- `TRANSLATE_LOCALE_SECRET=<32+ random chars>` — gates access to the edge function
- `GEMINI_API_KEY` — already configured for other functions
- `EXPO_PUBLIC_SUPABASE_URL=https://khvkwojtlkcvxjxztduj.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — for orchestrator local use only; never commit

---

## Task 1: Edge function skeleton + CORS + cost-cap test

**Files:**
- Create: `supabase/functions/translate_locale/index.ts`
- Create: `supabase/functions/translate_locale/__tests__/index.test.ts`

- [ ] **Step 1.1: Write the failing test**

```ts
// supabase/functions/translate_locale/__tests__/index.test.ts
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
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('missing secret → 401', async () => {
    const res = await handleRequest(
      makeReq({ target_locale: 'fr', source_keys: { a: 'A' }, sv_reference: { a: 'A' }, chunk_index: 0, total_chunks: 1 }, {
        headers: { 'x-translate-secret': 'wrong' },
      }),
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
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 1.3: Write minimal implementation**

```ts
// supabase/functions/translate_locale/index.ts
//
// Translates a chunk of mobile/src/i18n/locales/en.ts into one of the 12
// non-English locales using Gemini, with mobile/sv.ts as a brand-voice
// anchor. Called by mobile/scripts/translate-locales.ts.
//
// Auth: secret header (not user JWT) because the orchestrator runs from
// a dev workstation with a service-role key. Cost cap: 200 keys/request.
//
// Per supabase/functions/CLAUDE.md: deno entry + CORS preflight + manual
// auth. No checkOverload/enforceRateLimit (orchestrator is non-user).
// Tests at __tests__/index.test.ts import handleRequest directly, so
// serve() lives behind a Deno-only guard.

import { CORS_HEADERS } from '../_shared/cors.ts';

export const SUPPORTED_TARGET_LOCALES = [
  'ar', 'da', 'de', 'es', 'fa', 'fi', 'fr', 'it', 'nl', 'no', 'pl', 'pt',
] as const;
export type TargetLocale = (typeof SUPPORTED_TARGET_LOCALES)[number];

export const MAX_KEYS_PER_REQUEST = 200;

interface TranslateRequest {
  target_locale: string;
  source_keys: Record<string, string>;
  sv_reference: Record<string, string>;
  chunk_index: number;
  total_chunks: number;
}

function getSecret(): string | undefined {
  // Tests inject via globalThis; production reads from Deno.env.
  const injected = (globalThis as Record<string, unknown>).__TRANSLATE_LOCALE_SECRET__;
  if (typeof injected === 'string') return injected;
  if (typeof Deno !== 'undefined') return Deno.env.get('TRANSLATE_LOCALE_SECRET') ?? undefined;
  return undefined;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const expected = getSecret();
  const got = req.headers.get('x-translate-secret') ?? '';
  if (!expected || got !== expected) return json(401, { error: 'unauthorized' });

  let body: TranslateRequest;
  try {
    body = (await req.json()) as TranslateRequest;
  } catch {
    return json(400, { error: 'malformed json' });
  }

  if (!SUPPORTED_TARGET_LOCALES.includes(body.target_locale as TargetLocale)) {
    return json(400, { error: `unsupported target_locale: ${body.target_locale}` });
  }
  const keys = body.source_keys ?? {};
  const count = Object.keys(keys).length;
  if (count === 0) return json(400, { error: 'source_keys must be non-empty' });
  if (count > MAX_KEYS_PER_REQUEST) {
    return json(413, { error: `cost cap: max ${MAX_KEYS_PER_REQUEST} keys per request, got ${count}` });
  }

  // Translation call lands in Task 2. For now, echo so tests can assert shape.
  return json(200, {
    ok: true,
    target_locale: body.target_locale,
    translations: keys,
    chunk_index: body.chunk_index,
    missing_keys: [],
  });
}

if (typeof Deno !== 'undefined') {
  const { serve } = await import('https://deno.land/std@0.220.0/http/server.ts');
  serve(handleRequest);
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/index.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/functions/translate_locale/
git commit -m "feat(edge): translate_locale skeleton with CORS + secret gate + cost cap"
```

---

## Task 2: Placeholder-preservation validator

**Files:**
- Create: `supabase/functions/translate_locale/placeholders.ts`
- Create: `supabase/functions/translate_locale/__tests__/placeholders.test.ts`

The translation prompt asks Gemini to preserve `{placeholder}` tokens, but LLMs drop or rename them sometimes. The validator returns the set of `{xxx}` tokens in a string; the post-translation step compares input vs output and falls back to English for any key where the placeholder set differs.

- [ ] **Step 2.1: Write the failing test**

```ts
// supabase/functions/translate_locale/__tests__/placeholders.test.ts
import { describe, expect, it } from 'vitest';
import { extractPlaceholders, placeholderSetsMatch } from '../placeholders';

describe('extractPlaceholders', () => {
  it('returns empty set for plain string', () => {
    expect(extractPlaceholders('hello world')).toEqual(new Set());
  });
  it('captures single placeholder', () => {
    expect(extractPlaceholders('hi {name}')).toEqual(new Set(['name']));
  });
  it('captures multiple unique placeholders', () => {
    expect(extractPlaceholders('{count} of {total}')).toEqual(new Set(['count', 'total']));
  });
  it('deduplicates repeated placeholders', () => {
    expect(extractPlaceholders('{x} and {x}')).toEqual(new Set(['x']));
  });
  it('ignores non-placeholder braces', () => {
    expect(extractPlaceholders('not { a } placeholder { 1 }')).toEqual(new Set());
  });
});

describe('placeholderSetsMatch', () => {
  it('matches when both empty', () => {
    expect(placeholderSetsMatch('hi', 'hej')).toBe(true);
  });
  it('matches when same placeholders', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej {name}')).toBe(true);
  });
  it('mismatches when target drops a placeholder', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej')).toBe(false);
  });
  it('mismatches when target invents a placeholder', () => {
    expect(placeholderSetsMatch('hi', 'hej {who}')).toBe(false);
  });
  it('mismatches when placeholder renamed', () => {
    expect(placeholderSetsMatch('hi {name}', 'hej {namn}')).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/placeholders.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Write implementation**

```ts
// supabase/functions/translate_locale/placeholders.ts
//
// Mobile's `t()` helper interpolates {name}-style tokens. LLMs occasionally
// drop, rename, or fabricate them; the orchestrator compares the placeholder
// sets per key and falls back to English when they don't match.

const RE = /\{(\w+)\}/g;

export function extractPlaceholders(s: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  RE.lastIndex = 0;
  while ((m = RE.exec(s)) !== null) out.add(m[1]);
  return out;
}

export function placeholderSetsMatch(source: string, target: string): boolean {
  const a = extractPlaceholders(source);
  const b = extractPlaceholders(target);
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/placeholders.test.ts`
Expected: PASS — 10 tests green.

- [ ] **Step 2.5: Commit**

```bash
git add supabase/functions/translate_locale/
git commit -m "feat(edge): translate_locale placeholder-preservation validator + tests"
```

---

## Task 3: Wire Gemini call into translate_locale

**Files:**
- Modify: `supabase/functions/translate_locale/index.ts`
- Modify: `supabase/functions/translate_locale/__tests__/index.test.ts`

The handler builds a system prompt that pins brand voice (sv as anchor), preserves placeholders, and demands JSON-only output. Calls `callBursAI` with complexity `standard`. Post-validates placeholder integrity and surfaces dropped keys.

- [ ] **Step 3.1: Add the failing translation-success test**

Add to `__tests__/index.test.ts` (after the existing describe block):

```ts
import { vi } from 'vitest';
import * as bursAi from '../../_shared/burs-ai';

describe('translate_locale — Gemini call', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__TRANSLATE_LOCALE_SECRET__ = okSecret;
    vi.restoreAllMocks();
  });

  it('returns translated keys when Gemini responds well', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: JSON.stringify({
        translations: { 'auth.signIn.cta': 'Se connecter', 'auth.signUp.cta': "S'inscrire" },
      }),
    } as unknown as Awaited<ReturnType<typeof bursAi.callBursAI>>);

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
      data: JSON.stringify({
        translations: { 'a': 'A_fr' }, // model dropped 'b'
      }),
    } as unknown as Awaited<ReturnType<typeof bursAi.callBursAI>>);

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
      data: JSON.stringify({
        translations: { greet: 'Bonjour {nom}' }, // renamed {name}→{nom}
      }),
    } as unknown as Awaited<ReturnType<typeof bursAi.callBursAI>>);

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
    expect(body.translations.greet).toBe('Hello {name}'); // passthrough
  });

  it('returns 502 when Gemini emits unparseable JSON', async () => {
    vi.spyOn(bursAi, 'callBursAI').mockResolvedValue({
      data: 'not json at all',
    } as unknown as Awaited<ReturnType<typeof bursAi.callBursAI>>);

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
```

- [ ] **Step 3.2: Run tests to confirm they fail**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/index.test.ts`
Expected: FAIL — Gemini call not wired yet, handler still echoes input.

- [ ] **Step 3.3: Replace echo with Gemini call**

Replace the body of `handleRequest` after the cost-cap check (the line currently returning `{ ok: true, ..., translations: keys }`) with:

```ts
  // Build the prompt. sv_reference acts as a brand-voice anchor — the model
  // sees how the same keys land in Swedish (curated hand-translation by a
  // native author) and is asked to match the register in the target locale.
  // JSON-only output keeps the parser trivial.
  const systemPrompt = `You are a senior translator for a fashion/wardrobe app called BURS.
The Swedish dictionary below is hand-curated and establishes the brand voice (terse, premium, minimal, sentence case).
Translate the source dictionary to ${body.target_locale}, matching that register.
Hard rules:
- Preserve every {placeholder} token EXACTLY (same name, same braces).
- Preserve sentence case (do not Title Case strings).
- Never invent keys or omit keys.
- Output JSON only, no commentary, of shape: {"translations": {"<key>": "<translation>"}}.`;

  const userPrompt = JSON.stringify({
    target_locale: body.target_locale,
    sv_anchor: body.sv_reference,
    source: keys,
  });

  let aiData: string;
  try {
    const { callBursAI } = await import('../_shared/burs-ai.ts');
    const result = await callBursAI({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      complexity: 'standard',
      functionName: 'translate_locale',
      responseFormat: { type: 'json_object' },
    } as Parameters<typeof callBursAI>[0]);
    aiData = (result as { data?: unknown }).data as string;
  } catch (err) {
    return json(502, { error: 'translate_locale: gemini call failed', detail: String(err) });
  }

  let parsed: { translations?: Record<string, string> };
  try {
    parsed = JSON.parse(aiData);
  } catch {
    return json(502, { error: 'translate_locale: malformed JSON from gemini' });
  }
  const got = parsed.translations ?? {};

  // Apply placeholder guard: any translation whose {xxx} set differs from
  // the source falls back to the English passthrough. This is preferable to
  // shipping `Bonjour {nom}` when `t('greet', { name: 'X' })` won't substitute.
  const { placeholderSetsMatch } = await import('./placeholders.ts');
  const translations: Record<string, string> = {};
  const missing: string[] = [];
  for (const k of Object.keys(keys)) {
    const src = keys[k];
    const tgt = got[k];
    if (typeof tgt !== 'string' || tgt.length === 0) {
      missing.push(k);
      continue;
    }
    if (!placeholderSetsMatch(src, tgt)) {
      translations[k] = src; // passthrough on placeholder mismatch
      continue;
    }
    translations[k] = tgt;
  }

  return json(200, {
    ok: missing.length === 0,
    target_locale: body.target_locale,
    translations,
    chunk_index: body.chunk_index,
    missing_keys: missing,
  });
}
```

Remove the previous placeholder return (`return json(200, { ok: true, target_locale: body.target_locale, translations: keys, ... })`).

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/translate_locale/__tests__/index.test.ts`
Expected: PASS — 8 tests green (4 from Task 1, 4 added here).

- [ ] **Step 3.5: deno check**

Run: `deno check supabase/functions/translate_locale/index.ts`
Expected: 0 errors.

- [ ] **Step 3.6: Commit**

```bash
git add supabase/functions/translate_locale/
git commit -m "feat(edge): translate_locale Gemini call + placeholder guard"
```

---

## Task 4: Orchestrator skeleton — parse en.ts + sv.ts

**Files:**
- Create: `mobile/scripts/translate-locales.ts`
- Create: `mobile/scripts/__tests__/translate-locales.test.ts`

The orchestrator is plain Node + `tsx` (already in mobile devDeps via expo). Reads en.ts + sv.ts using a regex parser (avoids needing a full TS parser). The first task only handles parsing.

- [ ] **Step 4.1: Write failing parser test**

```ts
// mobile/scripts/__tests__/translate-locales.test.ts
import { describe, expect, it } from '@jest/globals';
import { parseLocaleFile } from '../translate-locales';

describe('parseLocaleFile', () => {
  it('extracts keys from a minimal locale source', () => {
    const src = `
export const en: Record<string, string> = {
  'a.b': 'Hello',
  "c.d": 'World {name}',
  // a comment
  'e.f': "Welcome",
};
`;
    expect(parseLocaleFile(src)).toEqual({
      'a.b': 'Hello',
      'c.d': 'World {name}',
      'e.f': 'Welcome',
    });
  });

  it('preserves insertion order', () => {
    const src = `
export const en: Record<string, string> = {
  'z': 'Z',
  'a': 'A',
  'm': 'M',
};
`;
    expect(Object.keys(parseLocaleFile(src))).toEqual(['z', 'a', 'm']);
  });

  it('handles single-quoted values with escaped quotes', () => {
    const src = `
export const en: Record<string, string> = {
  'k': 'don\\'t',
};
`;
    expect(parseLocaleFile(src)).toEqual({ k: "don't" });
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `cd mobile && npx jest src/../scripts/__tests__/translate-locales.test.ts --no-coverage 2>&1 | tail -10`

Wait — Jest's `roots` config doesn't include `mobile/scripts/`. Skip Jest for these tests and use a one-shot node check via assert (the orchestrator doesn't ship into the app). Replace step 4.1 with a tiny manual check.

Replace test file with a simple node-runnable check at `mobile/scripts/__tests__/translate-locales.check.mjs`:

```js
// mobile/scripts/__tests__/translate-locales.check.mjs
// Standalone smoke check — run with `node mobile/scripts/__tests__/translate-locales.check.mjs`.
// (Jest's roots config doesn't cover mobile/scripts; this file is the
// lightweight alternative for orchestrator helpers.)
import assert from 'node:assert/strict';
import { parseLocaleFile } from '../translate-locales.ts.compiled.mjs';

const src1 = `export const en: Record<string, string> = {
  'a.b': 'Hello',
  "c.d": 'World {name}',
};`;
assert.deepEqual(parseLocaleFile(src1), { 'a.b': 'Hello', 'c.d': 'World {name}' });

console.log('parseLocaleFile OK');
```

Actually that's awkward because we'd need to compile the .ts. Simpler: write the orchestrator as `.mjs` so Node runs it directly. Drop the .ts approach.

**Decision:** rewrite Step 4.1 — use ES Modules JavaScript, not TypeScript, for the orchestrator. Type safety isn't critical for a 200-LOC dev script and it makes testing/running trivial.

Replace `mobile/scripts/translate-locales.ts` with `mobile/scripts/translate-locales.mjs`. Throughout the rest of the plan, references to `.ts` become `.mjs`.

Rewrite Step 4.1 cleanly:

Create `mobile/scripts/__tests__/translate-locales.test.mjs`:

```js
// mobile/scripts/__tests__/translate-locales.test.mjs
// Run with: node --test mobile/scripts/__tests__/translate-locales.test.mjs
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
```

Run: `node --test mobile/scripts/__tests__/translate-locales.test.mjs`
Expected: FAIL — file not found.

- [ ] **Step 4.3: Write parser**

Create `mobile/scripts/translate-locales.mjs`:

```js
#!/usr/bin/env node
// translate-locales — drives translate_locale edge function to produce
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
// Output: mobile/src/i18n/locales/<locale>.ts (overwrites)

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
```

- [ ] **Step 4.4: Run test to verify it passes**

Run: `node --test mobile/scripts/__tests__/translate-locales.test.mjs`
Expected: PASS — 3 tests green.

- [ ] **Step 4.5: Smoke-parse the real en.ts**

Add a one-off check at the end of the test file:

```js
test('parses real mobile/src/i18n/locales/en.ts', async () => {
  const { readFileSync } = await import('node:fs');
  const path = new URL('../../src/i18n/locales/en.ts', import.meta.url);
  const src = readFileSync(path, 'utf8');
  const obj = parseLocaleFile(src);
  const keys = Object.keys(obj);
  assert.ok(keys.length >= 1500, `expected >=1500 keys, got ${keys.length}`);
  assert.equal(typeof obj['nav.today'] ?? 'string', 'string');
});
```

Run again. Expected: PASS, key count ≥ 1500.

- [ ] **Step 4.6: Commit**

```bash
git add mobile/scripts/translate-locales.mjs mobile/scripts/__tests__/translate-locales.test.mjs
git commit -m "feat(mobile): translate-locales orchestrator — parser + tests"
```

---

## Task 5: Chunking + edge-function POST loop

**Files:**
- Modify: `mobile/scripts/translate-locales.mjs`
- Modify: `mobile/scripts/__tests__/translate-locales.test.mjs`

Adds `chunkObject` and `translateOneLocale`. Sequential POST per chunk (no parallel — keeps logs clear, respects Gemini per-key throughput).

- [ ] **Step 5.1: Write chunking test**

Append to test file:

```js
import { chunkObject } from '../translate-locales.mjs';

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
```

- [ ] **Step 5.2: Run — fail**

Run: `node --test mobile/scripts/__tests__/translate-locales.test.mjs`
Expected: FAIL — chunkObject not exported.

- [ ] **Step 5.3: Implement chunking + POST**

Append to `mobile/scripts/translate-locales.mjs`:

```js
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
```

- [ ] **Step 5.4: Add edge-call mock test**

Append to test file:

```js
test('translateOneLocale walks chunks sequentially and merges results', async () => {
  const source = {};
  for (let i = 0; i < 5; i++) source['k' + i] = 'v' + i;
  const sv = { k0: 'V_0' };
  const calls = [];
  const fakeEdge = async (_url, _secret, payload) => {
    calls.push(payload);
    const translations = {};
    for (const k of Object.keys(payload.source_keys)) translations[k] = 'fr_' + payload.source_keys[k];
    return { status: 200, body: { ok: true, target_locale: 'fr', translations, chunk_index: payload.chunk_index, missing_keys: [] } };
  };
  const { translateOneLocale } = await import('../translate-locales.mjs');
  const out = await translateOneLocale({
    targetLocale: 'fr', source, sv,
    envUrl: 'http://x', secret: 's', log: () => {}, edgeCall: fakeEdge,
  });
  assert.equal(calls.length, 1); // 5 keys, chunk size 80 → one chunk
  assert.equal(calls[0].sv_reference.k0, 'V_0');
  assert.equal(out.translations.k0, 'fr_v0');
  assert.equal(out.translations.k4, 'fr_v4');
});
```

- [ ] **Step 5.5: Run — pass**

Run: `node --test mobile/scripts/__tests__/translate-locales.test.mjs`
Expected: PASS — 5 tests green.

- [ ] **Step 5.6: Commit**

```bash
git add mobile/scripts/translate-locales.mjs mobile/scripts/__tests__/translate-locales.test.mjs
git commit -m "feat(mobile): translate-locales chunking + edge POST loop + tests"
```

---

## Task 6: File renderer + CLI entrypoint

**Files:**
- Modify: `mobile/scripts/translate-locales.mjs`
- Modify: `mobile/scripts/__tests__/translate-locales.test.mjs`

Renders a translation map to a `<locale>.ts` file matching the existing en/sv format. Adds a `main()` CLI driver that reads env, loads sources, iterates target locales, writes files.

- [ ] **Step 6.1: Write renderer test**

Append:

```js
import { renderLocaleFile } from '../translate-locales.mjs';

test('renderLocaleFile emits valid TS module with header + sorted-as-input keys', () => {
  const out = renderLocaleFile('fr', {
    'nav.today': "Aujourd'hui",
    'home.title': 'Bonjour {name}',
  }, { sourceSha: 'abc1234' });
  assert.match(out, /export const fr: Record<string, string> = \{/);
  assert.match(out, /'nav\.today': "Aujourd'hui",/);
  assert.match(out, /'home\.title': 'Bonjour \{name\}',/);
  assert.match(out, /Auto-generated by mobile\/scripts\/translate-locales\.mjs/);
  assert.match(out, /Source: mobile\/src\/i18n\/locales\/en\.ts \(hash abc1234\)/);
  assert.ok(out.trimEnd().endsWith('};'));
});

test('renderLocaleFile escapes single quotes in values when single-quote-wrapping', () => {
  const out = renderLocaleFile('fr', { greet: "don't" });
  // Should pick double-quote wrap because value has a single quote.
  assert.match(out, /'greet': "don't",/);
});
```

- [ ] **Step 6.2: Run — fail**

Expected: FAIL — renderLocaleFile not exported.

- [ ] **Step 6.3: Implement renderer + main()**

Append to `mobile/scripts/translate-locales.mjs`:

```js
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
    // Pick the wrapping quote that doesn't require escaping the value.
    let wrap = "'";
    if (v.includes("'") && !v.includes('"')) wrap = '"';
    let escaped = v;
    if (wrap === "'") escaped = v.replace(/'/g, "\\'");
    else escaped = v.replace(/"/g, '\\"');
    lines.push(`  '${k.replace(/'/g, "\\'")}': ${wrap}${escaped}${wrap},`);
  }
  return header + lines.join('\n') + '\n};\n';
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const onlyMissing = argv.includes('--only-missing');
  let targets = TARGET_LOCALES;
  const localesArg = argv.find((a) => a.startsWith('--locales'));
  if (localesArg) {
    const csv = localesArg.includes('=') ? localesArg.split('=')[1] : argv[argv.indexOf(localesArg) + 1];
    targets = csv.split(',').filter((x) => TARGET_LOCALES.includes(x));
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

  // crude content hash for the file header (avoids dep on git for parity tracking)
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
    const { translations, missing } = await translateOneLocale({
      targetLocale: target, source, sv, envUrl, secret,
    });

    let final = translations;
    if (onlyMissing && existsSync(outPath)) {
      const prev = parseLocaleFile(readFileSync(outPath, 'utf8'));
      final = { ...prev, ...translations };
    }
    writeFileSync(outPath, renderLocaleFile(target, final, { sourceSha }), 'utf8');
    console.log(`  wrote ${outPath} (${Object.keys(final).length} keys, ${missing.length} fell back to en)`);
  }
}

// Run main when executed directly, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 6.4: Run tests**

Run: `node --test mobile/scripts/__tests__/translate-locales.test.mjs`
Expected: PASS — 7 tests green.

- [ ] **Step 6.5: Dry-run the CLI**

Run: `node mobile/scripts/translate-locales.mjs --dry-run`
Expected: prints `Source: en (1616 keys) + sv anchor (1616 keys)`, target list, then exits.

- [ ] **Step 6.6: Commit**

```bash
git add mobile/scripts/translate-locales.mjs mobile/scripts/__tests__/translate-locales.test.mjs
git commit -m "feat(mobile): translate-locales renderer + CLI driver"
```

---

## Task 7: Deploy edge function + provision secret

External actions. Cannot be done from Claude Code — the user runs these.

- [ ] **Step 7.1: Generate the shared secret**

Run on the dev machine:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-char hex string.

- [ ] **Step 7.2: Set secret in Supabase**

Run on the dev machine:

```bash
npx supabase secrets set TRANSLATE_LOCALE_SECRET=<the-hex-string> --project-ref khvkwojtlkcvxjxztduj
```

Expected: `Set "TRANSLATE_LOCALE_SECRET" successfully.`

- [ ] **Step 7.3: Deploy the function**

```bash
npx supabase functions deploy translate_locale --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

Expected: success message + function URL.

- [ ] **Step 7.4: Verify health with curl**

```bash
curl -i -X POST https://khvkwojtlkcvxjxztduj.supabase.co/functions/v1/translate_locale \
  -H "content-type: application/json" \
  -H "x-translate-secret: <the-hex-string>" \
  -d '{"target_locale":"fr","source_keys":{"hello":"Hello {name}"},"sv_reference":{"hello":"Hej {name}"},"chunk_index":0,"total_chunks":1}'
```

Expected: `HTTP/2 200` with `{"ok":true,"target_locale":"fr","translations":{"hello":"Bonjour {name}"},...}` (or similar — model output is non-deterministic).

- [ ] **Step 7.5: Record secret locally**

Write the secret + URL to `mobile/.env.local` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://khvkwojtlkcvxjxztduj.supabase.co
TRANSLATE_LOCALE_SECRET=<the-hex-string>
```

No commit. User confirms verbally.

---

## Task 8: Run the orchestrator → generate 12 dictionaries

- [ ] **Step 8.1: Load env + run orchestrator**

Run:

```bash
set -a; source mobile/.env.local; set +a; node mobile/scripts/translate-locales.mjs
```

(On Windows PowerShell: `Get-Content mobile/.env.local | ForEach-Object { $name, $value = $_ -split '=', 2; [Environment]::SetEnvironmentVariable($name, $value, 'Process') }; node mobile/scripts/translate-locales.mjs`)

Expected: ~10 minute run, prints chunk progress per locale, ends with 12 new files in `mobile/src/i18n/locales/`.

- [ ] **Step 8.2: Sanity-check key counts**

Run:

```bash
wc -l mobile/src/i18n/locales/*.ts
```

Expected: each new file ~1700–1750 lines (1616 keys + header), comparable to sv.ts.

- [ ] **Step 8.3: Spot-check translations**

Open `mobile/src/i18n/locales/fr.ts` and `ar.ts` and `de.ts`. Verify:
- `'nav.today':` value is a sensible translation (e.g. `"Aujourd'hui"`, `"اليوم"`, `"Heute"`).
- A key with a placeholder (e.g. `'unlock.add_x_to_unlock'` → `'Add {count} more garments to unlock'`) has `{count}` preserved in the translation.
- No obvious raw English strings (other than brand terms like "BURS").

If 3+ obvious quality issues found, re-run that locale: `node mobile/scripts/translate-locales.mjs --locales fr` (overwrites).

- [ ] **Step 8.4: Commit the dictionaries**

```bash
git add mobile/src/i18n/locales/{ar,da,de,es,fa,fi,fr,it,nl,no,pl,pt}.ts
git commit -m "feat(mobile): generate 12 locale dictionaries (ar/da/de/es/fa/fi/fr/it/nl/no/pl/pt)"
```

---

## Task 9: Wire dictionaries into i18n.ts

**Files:**
- Modify: `mobile/src/lib/i18n.ts`

- [ ] **Step 9.1: Verify current shape**

Read `mobile/src/lib/i18n.ts:21-81`. Confirm:
- `Locale` union declares 10 entries.
- `SUPPORTED_LOCALES` lists 10.
- `DICTIONARIES` aliases 8 to `en`.

- [ ] **Step 9.2: Expand the type, imports, and dictionary table**

Replace:

```ts
import { en } from '../i18n/locales/en';
import { sv } from '../i18n/locales/sv';
import { log } from './log';

export type Locale =
  | 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';

const SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'sv', 'fr', 'de', 'es', 'it', 'ar', 'fa', 'pl', 'pt',
];
```

With:

```ts
import { en } from '../i18n/locales/en';
import { sv } from '../i18n/locales/sv';
import { ar } from '../i18n/locales/ar';
import { da } from '../i18n/locales/da';
import { de } from '../i18n/locales/de';
import { es } from '../i18n/locales/es';
import { fa } from '../i18n/locales/fa';
import { fi } from '../i18n/locales/fi';
import { fr } from '../i18n/locales/fr';
import { it } from '../i18n/locales/it';
import { nl } from '../i18n/locales/nl';
import { no } from '../i18n/locales/no';
import { pl } from '../i18n/locales/pl';
import { pt } from '../i18n/locales/pt';
import { log } from './log';

export type Locale =
  | 'en' | 'sv' | 'ar' | 'da' | 'de' | 'es' | 'fa' | 'fi'
  | 'fr' | 'it' | 'nl' | 'no' | 'pl' | 'pt';

const SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'sv', 'ar', 'da', 'de', 'es', 'fa', 'fi',
  'fr', 'it', 'nl', 'no', 'pl', 'pt',
];
```

And replace:

```ts
const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en,
  sv,
  // Other locales fall back to English until their dictionaries land.
  // The resolver `dict[key] ?? en[key] ?? key` means partial dictionaries
  // are safe — any unset Swedish key resolves to its English value.
  fr: en, de: en, es: en, it: en, ar: en, fa: en, pl: en, pt: en,
};
```

With:

```ts
const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en, sv, ar, da, de, es, fa, fi, fr, it, nl, no, pl, pt,
};
```

- [ ] **Step 9.3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 9.4: Lint**

Run: `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0`
Expected: 0 warnings.

- [ ] **Step 9.5: Commit**

```bash
git add mobile/src/lib/i18n.ts
git commit -m "feat(mobile): wire 14 locales into i18n.ts dispatcher"
```

---

## Task 10: Expand LanguageStep to 14 entries

**Files:**
- Modify: `mobile/src/screens/onboarding/LanguageStep.tsx`

- [ ] **Step 10.1: Update LanguageCode type**

Replace line 18 from:

```ts
export type LanguageCode = 'en' | 'sv' | 'fr' | 'de' | 'es' | 'it' | 'ar' | 'fa' | 'pl' | 'pt';
```

To:

```ts
export type LanguageCode =
  | 'en' | 'sv' | 'ar' | 'da' | 'de' | 'es' | 'fa' | 'fi'
  | 'fr' | 'it' | 'nl' | 'no' | 'pl' | 'pt';
```

- [ ] **Step 10.2: Update LANGUAGES array**

Replace lines 22-33 (the `LANGUAGES` const) with:

```ts
const LANGUAGES: readonly LanguageEntry[] = [
  { code: 'en', name: 'English',     flag: '🇬🇧' },
  { code: 'sv', name: 'Svenska',     flag: '🇸🇪' },
  { code: 'ar', name: 'العربية',     flag: '🇸🇦' },
  { code: 'da', name: 'Dansk',       flag: '🇩🇰' },
  { code: 'de', name: 'Deutsch',     flag: '🇩🇪' },
  { code: 'es', name: 'Español',     flag: '🇪🇸' },
  { code: 'fa', name: 'فارسی',       flag: '🇮🇷' },
  { code: 'fi', name: 'Suomi',       flag: '🇫🇮' },
  { code: 'fr', name: 'Français',    flag: '🇫🇷' },
  { code: 'it', name: 'Italiano',    flag: '🇮🇹' },
  { code: 'nl', name: 'Nederlands',  flag: '🇳🇱' },
  { code: 'no', name: 'Norsk',       flag: '🇳🇴' },
  { code: 'pl', name: 'Polski',      flag: '🇵🇱' },
  { code: 'pt', name: 'Português',   flag: '🇧🇷' },
];
```

- [ ] **Step 10.3: Update header comment**

Replace lines 1-4 from:

```
// LanguageStep — onboarding step 1.
// 10 supported languages, default English. Country-flag emojis are intentionally
// allowed here only (per the user's spec) — they're geographic identifiers, not
// decorative emojis. Every other screen in the app stays emoji-free.
```

To:

```
// LanguageStep — onboarding step 1.
// 14 supported languages, default English. Country-flag emojis are intentionally
// allowed here only (per the user's spec) — they're geographic identifiers, not
// decorative emojis. Every other screen in the app stays emoji-free.
```

Also fix the inline comment at lines 46-48 ("10-language whitelist" → "14-language whitelist").

- [ ] **Step 10.4: Typecheck + lint**

Run: `cd mobile && npx tsc --noEmit && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0`
Expected: 0 errors / 0 warnings.

- [ ] **Step 10.5: Commit**

```bash
git add mobile/src/screens/onboarding/LanguageStep.tsx
git commit -m "feat(mobile): expand LanguageStep picker from 10 → 14 locales"
```

---

## Task 11: Extend i18n-diff to all 14 locales

**Files:**
- Modify: `scripts/i18n-diff.mjs`

The current script only compares en↔sv. Extend to walk every `mobile/src/i18n/locales/*.ts` and report missing keys against `en.ts`.

- [ ] **Step 11.1: Rewrite the script**

Open `scripts/i18n-diff.mjs`. Replace the constants block (`EN_PATH`, `SV_PATH`) and the final analysis section with a multi-locale loop. Full replacement:

```js
#!/usr/bin/env node
// i18n-diff: report keys missing in any mobile locale relative to en.ts.
//
// Usage:
//   node scripts/i18n-diff.mjs            # summary; exit 1 if any locale incomplete
//   node scripts/i18n-diff.mjs --missing  # all missing keys per locale, one per line
//   node scripts/i18n-diff.mjs --orphans  # all orphan keys per locale, one per line
//   node scripts/i18n-diff.mjs --json     # full JSON report

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOCALES_DIR = resolve(ROOT, 'mobile/src/i18n/locales');
const EN_PATH = resolve(LOCALES_DIR, 'en.ts');

function extractKeys(filePath) {
  let src = readFileSync(filePath, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  const keys = new Set();
  const dupes = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*:/g;
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
  .map((f) => ({ locale: basename(f, '.ts'), path: resolve(LOCALES_DIR, f) }));

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
  if (enDupes.length) process.stdout.write(`duplicates in en: ${enDupes.length} (${enDupes.slice(0, 5).join(', ')}${enDupes.length > 5 ? '…' : ''})\n`);
  process.stdout.write('\nlocale | keys | missing | orphan | dupes\n');
  process.stdout.write(  '-------|------|---------|--------|------\n');
  for (const [locale, r] of Object.entries(report)) {
    process.stdout.write(`${locale.padEnd(6)} | ${String(r.count).padEnd(4)} | ${String(r.missing.length).padEnd(7)} | ${String(r.orphan.length).padEnd(6)} | ${r.dupes.length}\n`);
  }
}

const hasMissing = Object.values(report).some((r) => r.missing.length > 0);
const hasDupes = enDupes.length > 0 || Object.values(report).some((r) => r.dupes.length > 0);
if (hasMissing || hasDupes) process.exit(1);
process.exit(0);
```

- [ ] **Step 11.2: Run the script**

Run: `node scripts/i18n-diff.mjs`
Expected: a 14-locale table; exit 0 (zero missing) assuming Task 8 completed cleanly.

If any locale shows missing keys: re-run `node mobile/scripts/translate-locales.mjs --locales <those> --only-missing`, re-commit.

- [ ] **Step 11.3: Commit**

```bash
git add scripts/i18n-diff.mjs
git commit -m "chore: extend i18n-diff.mjs from en↔sv to all 14 locales"
```

---

## Task 12: Add GitHub Actions i18n-diff gate

**Files:**
- Modify: `.github/workflows/mobile-ci.yml`

Add a new `i18n-diff` job at the bottom of the workflow, parallel to the others. ~5s runtime.

- [ ] **Step 12.1: Append the job**

Open `.github/workflows/mobile-ci.yml`. At the end of the `jobs:` block (after `migration-smoke`), append:

```yaml
  # i18n drift guard — fails when any locale in mobile/src/i18n/locales/
  # lacks a key that en.ts has. Forces dev to re-run translate-locales.mjs
  # whenever en.ts grows. The script also catches duplicate keys (manual
  # edit error). Bundled in this workflow rather than a standalone one so
  # branch protection lists it alongside the other mobile gates.
  i18n-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Run i18n-diff
        run: node scripts/i18n-diff.mjs
```

- [ ] **Step 12.2: Smoke the script one more time**

Run: `node scripts/i18n-diff.mjs`
Expected: clean exit.

- [ ] **Step 12.3: Commit**

```bash
git add .github/workflows/mobile-ci.yml
git commit -m "ci(mobile): add i18n-diff job (14-locale drift gate)"
```

---

## Task 13: Final gates + push + PR

- [ ] **Step 13.1: Run the full local gate suite**

Run:

```bash
cd mobile && npx tsc --noEmit
cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0
cd mobile && npx jest --no-coverage
cd mobile && npx expo-doctor
cd .. && node scripts/i18n-diff.mjs
```

Expected: 0 errors / 0 warnings / 337+ tests pass / 17/17 expo-doctor / i18n-diff exits 0.

Vitest (edge function tests):

```bash
cd .. && npx vitest run supabase/functions/translate_locale/__tests__/
```

Expected: all green (12+ tests).

Deno check:

```bash
deno check supabase/functions/translate_locale/index.ts
```

Expected: 0 errors.

Orchestrator smoke:

```bash
node --test mobile/scripts/__tests__/translate-locales.test.mjs
```

Expected: all green.

- [ ] **Step 13.2: Push branch**

```bash
git push -u origin feat/mobile-i18n-14-locale-expansion
```

- [ ] **Step 13.3: Open PR**

```bash
gh pr create --title "feat(mobile): 14-locale i18n expansion + drift CI gate" --body "$(cat <<'EOF'
## Summary

Ships ar / da / de / es / fa / fi / fr / it / nl / no / pl / pt as real translated mobile dictionaries alongside the existing en + sv (PR scope: 12 new locale files, i18n dispatcher rewrite, LanguageStep picker expansion, multi-locale CI drift gate).

Translation pipeline lives behind a new edge function (`translate_locale`) that takes a chunk of mobile/en.ts plus the matching sv.ts subset as a brand-voice anchor, then routes through `callBursAI` (Gemini 2.5 Flash) with JSON-mode and a placeholder-preservation guard. A local orchestrator (`mobile/scripts/translate-locales.mjs`) chunks en.ts into 80-key batches and writes one `<lang>.ts` per locale.

Spec: `docs/launch/waves/i18n-14-locale-expansion.md`.

## Why now (launch-freeze override)

User-directed 2026-05-18. Unlocks the Nordics / UK / NL launch markets named in CLAUDE.md project facts. Logged in spec.

## Edge-function exception

`translate_locale` is a new edge function. CLAUDE.md normally requires wave authorization; user explicitly approved during brainstorming on 2026-05-18. Cost-capped at 200 keys/request; gated by `TRANSLATE_LOCALE_SECRET` header (no public access).

## Test plan

- [x] Edge function: vitest 12/12 pass (gating, Gemini call, placeholder guard, fallbacks)
- [x] Orchestrator: node --test 7/7 pass (parser, chunking, renderer, edge POST loop)
- [x] Mobile: tsc 0 errors, eslint 0 warnings, jest 337/337
- [x] i18n-diff: 0 missing / 0 orphans / 0 dupes across all 14 locales
- [x] expo-doctor: 17/17
- [x] deno check: clean
- [ ] Manual: switch each new locale in LanguageStep and navigate Home / AddPiece / Filters / Settings; no raw `key.like.this` strings appear
- [ ] Manual: RTL spot-check (ar/fa) — dictionaries land but layout-direction support is OUT OF SCOPE for this PR (follow-up wave)

## Deploy steps after merge

1. `TRANSLATE_LOCALE_SECRET` secret already provisioned (Task 7)
2. `npx supabase functions deploy translate_locale --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL returned. CI runs all gates including new `i18n-diff` job.

- [ ] **Step 13.4: Watch CI**

```bash
sleep 30 && gh pr checks
```

If any check fails, fix and re-push. Don't merge — that's the user's call after device testing.
