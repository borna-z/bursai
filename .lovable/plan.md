

# Fix Incomplete Translations — All 12 Non-English Languages

## Problem
Swedish has ~500+ translation keys. English matches it. But the other 12 languages are severely incomplete:

| Language | Approx Keys | Coverage |
|---|---|---|
| sv (base) | ~500+ | 100% |
| en | ~500+ | 100% |
| no | ~300 | ~60% |
| da, fi, de | ~200 | ~40% |
| fr | ~180 | ~36% |
| ar, fa | ~150 | ~30% |
| es | ~100 | ~20% |
| it, pt, nl, pl | ~60 | ~12% |

The fallback chain `translations[locale]?.[key] ?? translations['sv']?.[key]` fills missing keys with Swedish, creating a broken mixed-language UI.

## Solution
Complete all 12 language objects to have 100% key parity with Swedish. This is a large but straightforward task — every key in `sv` must exist in every other locale.

## Approach
Due to file size constraints (~6738 lines currently, will grow to ~30,000+), this will be done in batches by language group:

**Batch 1** — Scandinavian (no, da, fi) — closest to Swedish, highest existing coverage
**Batch 2** — Western European (de, fr, es, it, pt, nl)  
**Batch 3** — Other (pl, ar, fa)

For each language, the complete set of ~500+ keys from `sv` will be translated, replacing the current partial objects.

## Files Changed
- `src/i18n/translations.ts` — Complete all 12 incomplete language objects to match `sv` key coverage

## Notes
- The compact single-line format used by non-sv/en languages will be maintained to keep file size manageable
- All translations will be native-quality (not literal word-for-word) matching the existing translation style already established in