# Mobile i18n — 14-locale expansion

**Status:** Approved (2026-05-18)
**Owner:** Claude (Opus 4.7) + user
**Related PRs:** #885 (audit fixes — must merge first)
**Launch impact:** Plan A enabler — unblocks non-Swedish App Store/Play Store listings.
**Freeze override:** User-directed 2026-05-18. CLAUDE.md ship-only freeze (until 2026-05-31) does not list this in REMAINING WORK; the override is logged here per the freeze-acknowledgment requirement. Justification: 14-language support unlocks the Nordics / UK / NL launch markets named in the project facts table.

## Problem

Mobile RN app currently ships **2 of 14 target locales** as real dictionaries:

| | en | sv | other |
|---|---|---|---|
| `mobile/src/i18n/locales/*.ts` | 1616 keys | 1616 keys (100% parity) | — |
| `lib/i18n.ts` `SUPPORTED_LOCALES` | declares 10 | — | fr/de/es/it/ar/fa/pl/pt **alias to `en`** |
| `LanguageStep` UI | shows 10 options | — | da/fi/nl/no missing entirely |

Goal: every locale in the web set (`ar, da, de, en, es, fa, fi, fr, it, nl, no, pl, pt, sv`) must be a real, populated dictionary that the mobile app renders end-to-end. The picker, the dispatcher, and every screen string must work for any of the 14.

**Why not reuse web translations?** Audit (2026-05-18): mobile vs `web/en.ts` overlap is **28 keys / 1616 (1.7%)**. Web uses `nav.today` namespace; mobile uses `addpiece.step3.field.price`. The two apps are parallel namespaces, not subsets. Web translations stay on the shelf except for the 28 trivial overlaps.

## Approach

Single dimension of work: **machine-translate mobile/en.ts → 12 missing locale dictionaries, using mobile/sv.ts as a brand-voice anchor.** Wire the resulting files into `i18n.ts` + `LanguageStep` and add a CI gate that prevents the 14 from drifting out of sync going forward.

Translation runs as a Supabase edge function (`translate_locale`) invoked by a local orchestrator script. The edge function is the reusable primitive; the script handles chunking, file emission, and re-runs.

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │  mobile/scripts/translate-locales.ts    │
                          │  (orchestrator, run by dev locally)     │
                          └────────────────┬────────────────────────┘
                                           │ 1. read en.ts + sv.ts
                                           │ 2. for each target locale:
                                           │    chunk to ~80 keys
                                           │    POST per chunk
                                           ▼
              ┌──────────────────────────────────────────────────────┐
              │  supabase/functions/translate_locale/index.ts        │
              │  Input: { source_keys, sv_reference, target_locale,  │
              │           chunk_index }                              │
              │  - Calls Gemini via existing _shared/burs-ai.ts      │
              │  - System prompt: pin brand voice, preserve {placeholders}│
              │  - Returns: { translations, locale, chunk_index }    │
              └──────────────────────────────────────────────────────┘
                                           │
                                           ▼
              mobile/src/i18n/locales/{ar,da,de,es,fa,fi,fr,it,nl,no,pl,pt}.ts
                                           │
                                           ▼
              mobile/src/lib/i18n.ts        ← 14 imports, expanded
              mobile/src/screens/onboarding/LanguageStep.tsx  ← 14 entries
                                           │
                                           ▼
              scripts/i18n-diff.mjs (extended)   ← compares all 14
              .github/workflows/mobile-ci.yml    ← new i18n-diff job
```

## Components

### 1. `supabase/functions/translate_locale/index.ts` (new)

**Override flag:** CLAUDE.md says "Never add new edge functions unless the wave file authorizes them." User explicitly authorized this in brainstorming on 2026-05-18. A short note in `docs/launch/may-2026-sprint/_audit-2026-05-17.md` records the exception.

**Contract:**

```ts
// Request
{
  target_locale: 'ar' | 'da' | 'de' | 'es' | 'fa' | 'fi' | 'fr' | 'it' | 'nl' | 'no' | 'pl' | 'pt',
  source_keys: Record<string, string>,   // chunk of mobile/en.ts entries
  sv_reference: Record<string, string>,  // matching subset of sv.ts (voice anchor)
  chunk_index: number,                   // 0-based; for telemetry only
  total_chunks: number,                  // for telemetry only
}
// Response
{
  ok: true,
  target_locale: string,
  translations: Record<string, string>,  // same keys as source_keys
  chunk_index: number,
  missing_keys: string[],                // any input key the model dropped (must be 0 for ok=true; otherwise ok=false + error)
}
```

**Auth:** `--no-verify-jwt` (orchestrator runs from dev workstation, not from a signed-in user session). Service-role bearer + a `TRANSLATE_LOCALE_SECRET` header check prevent random callers from racking up Gemini bills.

**Cost guard:** Reject when `Object.keys(source_keys).length > 200`. Orchestrator chunks to 80 by default; the cap is defense against a misconfigured caller.

**LLM:** Gemini 2.5 Pro via the existing `_shared/burs-ai.ts` OpenAI-compatible adapter. Same auth + retry semantics as `analyze_garment`. JSON-mode response constraint so the parser doesn't have to repair prose.

**Prompt skeleton (full prompt in the spec's implementation, not here):**
- System: "You are a senior translator for a fashion/wardrobe app called BURS. The Swedish dictionary below is hand-curated and establishes the voice (terse, premium, minimal). Match that register in {{target_locale}}. Preserve {placeholder} tokens exactly. Preserve sentence case. Never invent keys. Output JSON only."
- User: `{ source: <source_keys>, sv_anchor: <sv_reference>, target: '{{target_locale}}' }`

### 2. `mobile/scripts/translate-locales.ts` (new)

Node CLI. Run with `npx tsx mobile/scripts/translate-locales.ts [--locales ar,da,...] [--dry-run]`.

**Behavior:**
1. Read + parse `mobile/src/i18n/locales/en.ts` and `sv.ts` into key-ordered maps.
2. Determine target locale list (default: all missing 12 unless `--locales` overrides).
3. For each target:
   a. Chunk source keys to 80 per request (1616 keys / 80 = 21 chunks per locale).
   b. POST sequentially to `translate_locale` (no parallelism — Gemini quota + ordering matters for log clarity).
   c. Accumulate translations into a single ordered map.
   d. Render `mobile/src/i18n/locales/<locale>.ts` using the same header + format as `sv.ts` (export shape, key order matches en.ts).
4. Print a summary: `<locale>: translated <n>/<n_total> keys (<n_missing> filled from en fallback)`.

**Idempotency:** Re-running overwrites the file. If a file already exists with prior translations, the script accepts an `--only-missing` flag to only translate keys not yet present (useful for incrementally backfilling after `en.ts` grows new keys).

**Auth:** reads `TRANSLATE_LOCALE_SECRET` + `EXPO_PUBLIC_SUPABASE_URL` + a service-role key from `mobile/.env.local` (gitignored). Fails loudly if missing.

### 3. Generated locale files (12 new)

`mobile/src/i18n/locales/{ar,da,de,es,fa,fi,fr,it,nl,no,pl,pt}.ts`

Format matches existing `sv.ts`:
```ts
// Auto-generated by mobile/scripts/translate-locales.ts (2026-05-18).
// Source: mobile/src/i18n/locales/en.ts (hash <git-sha>).
// Voice anchor: mobile/src/i18n/locales/sv.ts.
// Edit by hand? Use --only-missing to incrementally regenerate.
// Append-only convention applies post-generation.

export const ar: Record<string, string> = {
  'splash.wordmark': '...',
  ...
};
```

### 4. `mobile/src/lib/i18n.ts` (extend)

- Expand `Locale` union from 10 → 14 (`add 'da' | 'fi' | 'nl' | 'no'`).
- Expand `SUPPORTED_LOCALES` from 10 → 14.
- Import the 12 new dictionaries.
- Populate `DICTIONARIES` with real references (drop the 8 `fr: en, de: en, ...` aliases).

### 5. `mobile/src/screens/onboarding/LanguageStep.tsx` (extend)

- Expand `LanguageCode` union from 10 → 14.
- Expand `LANGUAGES` array to add 4 new entries (da/fi/nl/no) with native-script labels and flag emojis. Keep alphabetical-by-code ordering.
  - `{ code: 'da', name: 'Dansk',    flag: '🇩🇰' }`
  - `{ code: 'fi', name: 'Suomi',    flag: '🇫🇮' }`
  - `{ code: 'nl', name: 'Nederlands', flag: '🇳🇱' }`
  - `{ code: 'no', name: 'Norsk',    flag: '🇳🇴' }`

### 6. `scripts/i18n-diff.mjs` (extend, then rename if needed)

Today: hard-coded to en↔sv. Extend to read every `mobile/src/i18n/locales/*.ts` and compare each to `en.ts`. Exit non-zero on any key that exists in en but missing in any other locale, plus the existing duplicate-key guard.

CLI flags preserved (`--missing`, `--orphans`, `--json`); semantics extended to multi-locale (e.g. `--json` returns `{ ar: { missing: [...] }, da: { ... }, ... }`).

### 7. `.github/workflows/mobile-ci.yml` (extend)

Add `i18n-diff` job under the existing Mobile CI workflow:

```yaml
i18n-diff:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20' }
    - run: node scripts/i18n-diff.mjs
```

Runs in parallel with `lint` / `typecheck` / `test`. ~5s job. Fails PR when any locale drifts.

## Data flow

1. Dev runs `npx tsx mobile/scripts/translate-locales.ts` (~10 min for all 12 locales — 252 sequential edge calls at ~2s each).
2. Script writes 12 new files.
3. Dev spot-checks samples (especially RTL: ar, fa; terse: da, no; formal: de, fr).
4. Dev commits everything, opens PR.
5. PR CI runs `i18n-diff` → green (zero drift).
6. After merge, any future PR that adds a key to `en.ts` without adding to all 13 others fails CI. Dev re-runs the script with `--only-missing` and re-commits.

## Error handling

| Failure | Behavior |
|---|---|
| Gemini returns malformed JSON | Edge function retries (existing burs-ai retry policy). If still bad → returns `ok:false`; orchestrator logs the chunk + locale and continues to next chunk. Final report flags the locale as partial. |
| Gemini drops keys from output | Edge function detects via `missing_keys[]` check, returns `ok:false`. Orchestrator retries the chunk once with reduced size (40 keys); if still bad, fills the missing keys with English passthrough and logs. |
| Edge function times out (>60s) | Orchestrator retries the chunk once with reduced size, then moves on. |
| Placeholder `{name}` mangled by translator | Caught by orchestrator's post-validation: every input value's `{xxx}` set must equal the output's `{xxx}` set per key. Mismatch → English passthrough for that key + warning. |
| CI gate finds drift | PR red. Dev runs script locally with `--only-missing` to fill the gap. |

## Testing

- **Edge function unit tests** (`supabase/functions/translate_locale/index.test.ts`): mock Gemini client, assert request shape + JSON-mode + placeholder preservation + chunk-cap rejection.
- **Orchestrator script smoke** (`mobile/scripts/__tests__/translate-locales.test.ts`): mock the edge POST, assert chunking math + file emission format + idempotency under re-run.
- **Diff script** (`scripts/__tests__/i18n-diff.test.mjs`): fixture-driven, asserts multi-locale drift detection + exit codes.
- **Manual spot-check checklist**: open the app, switch to each of the 12 new locales in `LanguageStep`, navigate Home / AddPiece / Filters / Settings, confirm no `key.like.this` raw strings appear. Especially: RTL layout under ar/fa (this spec does not add bidi support — see Out of scope).

## Validation gates (per CLAUDE.md per-PR workflow)

```bash
cd mobile && npx tsc --noEmit                  # 0 errors
cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0
cd mobile && npx jest                          # 337+ pass (added tests)
cd mobile && npx expo-doctor                   # 17/17
deno check supabase/functions/translate_locale/index.ts
node scripts/i18n-diff.mjs                     # exit 0
```

## Out of scope (explicitly)

- **RTL layout support** for ar/fa. The dictionaries land but the app does not flip layout direction. Tracked as follow-up (post-launch wave).
- **Date/number/currency formatting per locale** (intl). Mobile currently uses raw `toString()`. Tracked separately.
- **Translation of user-generated content** (garment titles entered by users). Not in scope.
- **Translation of AI/LLM output** (stylist chat, outfit descriptions). Edge functions already route through Gemini which speaks the locale set in the prompt — out of this PR.
- **Removing the 1.7% web overlap duplication.** Two sources of truth for those 28 keys is fine; they're rare and stable.

## Migration / deploy

- No DB migration.
- Edge function deploy after merge:
  `npx supabase functions deploy translate_locale --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt`
- Env var: set `TRANSLATE_LOCALE_SECRET` in Supabase project secrets before deploy.
- No mobile binary release tie-in — the 12 locales ship in the next EAS build.

## PR shape

**Single PR**, targeting `main`. Diff will be large but auto-generated:

```
+ supabase/functions/translate_locale/index.ts          (~250 LOC)
+ supabase/functions/translate_locale/index.test.ts     (~150 LOC)
+ mobile/scripts/translate-locales.ts                   (~200 LOC)
+ mobile/scripts/__tests__/translate-locales.test.ts    (~100 LOC)
+ mobile/src/i18n/locales/{ar,da,de,es,fa,fi,fr,it,nl,no,pl,pt}.ts  (~1700 LOC × 12)
M mobile/src/lib/i18n.ts                                (~25 LOC)
M mobile/src/screens/onboarding/LanguageStep.tsx        (~10 LOC)
M scripts/i18n-diff.mjs                                 (~80 LOC)
M .github/workflows/mobile-ci.yml                       (~15 LOC)
+ docs/launch/may-2026-sprint/i18n-14-locale-expansion.md  (record-keeping)
```

PR template body must explicitly call out the auto-generated locale files so reviewers focus on the script + edge function rather than line-by-line translation review.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Gemini translation quality is uneven across 12 locales | Med | sv-anchor in prompt; spot-check checklist; explicit "post-launch follow-up: human review pass" tracked in launch doc. |
| Hits launch freeze (ship-only until 2026-05-31) | Low | User explicitly directed this work; freeze override recorded in spec. Aligns with Plan A (App Store/Play Store) — 14 locales unlock additional market listings. |
| Edge function not in any wave file | Low | User explicitly authorized; documented in `_audit-2026-05-17.md` exceptions section. |
| Gemini API cost blow-up on accidental re-runs | Low | Cost guard (200 key cap per request); `TRANSLATE_LOCALE_SECRET` gates access; orchestrator's `--only-missing` flag avoids redundant re-translation. |
| Future en.ts grows → all 13 others go stale silently | Med | i18n-diff CI gate breaks the PR. Forces the next dev to re-run the script. |
| RTL locales render wrong | Med | Out of scope for this PR; flagged. Add follow-up wave. |

## Open questions

None — answered in brainstorming:
- Method: Gemini en+sv dual-reference
- Location: edge function + orchestrator script
- CI gate: yes, drift-blocking
