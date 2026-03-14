

# Full i18n Translation Plan — 110 Steps

## Current State

- **14 supported locales**: sv, en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa
- **sv and en** are fully translated (~700+ keys each, expanded format)
- **Other 12 locales** have partial coverage (~100-200 keys each), missing large sections (premium/billing, insights, discover, plan details, wardrobe advanced features, landing page, privacy/terms, settings GDPR, etc.)
- The fallback chain is: `locale → en → sv → raw key`
- File is ~9,800 lines total in `src/i18n/translations.ts`

## Approach

Use English as the canonical source. For each of the 12 incomplete locales, identify all missing keys and add professional translations. Split into 110 steps grouped by locale and domain.

Due to the file size, translations will be split into separate locale files (one per language) that get merged into the main `translations` object. This keeps each file manageable and avoids a single 20K+ line monster.

---

## Architecture Change (Steps 1-2)

**Step 1** — Create `src/i18n/locales/` directory structure with one file per locale (e.g. `en.ts`, `sv.ts`, `no.ts`, etc.), each exporting a `Record<string, string>`.

**Step 2** — Refactor `src/i18n/translations.ts` to import from individual locale files and compose the `translations` object. No functional change.

---

## Per-Locale Translation (Steps 3-110)

Each locale gets 9 steps, covering these domains:

| Step offset | Domain |
|---|---|
| +0 | Navigation, common, auth, error |
| +1 | Onboarding (all sub-steps, body, style, tutorial) |
| +2 | Settings (profile, appearance, privacy, GDPR, notifications, account) |
| +3 | Home, weather, plan, calendar |
| +4 | Wardrobe, garment details, scan, import, batch, duplicate |
| +5 | Outfits, outfit generation, stylist/chat |
| +6 | Insights, discover, premium, billing, pricing, trial |
| +7 | Landing page (hero, bento, showcase, pricing section, FAQ, footer, comparison) |
| +8 | Contact, privacy policy, terms, seed/admin, genimg, social reactions |

### Steps 3-11: Norwegian (no)
### Steps 12-20: Danish (da)
### Steps 21-29: Finnish (fi)
### Steps 30-38: German (de)
### Steps 39-47: French (fr)
### Steps 48-56: Spanish (es)
### Steps 57-65: Italian (it)
### Steps 66-74: Portuguese (pt)
### Steps 75-83: Dutch (nl)
### Steps 84-92: Polish (pl)
### Steps 93-101: Arabic (ar)
### Steps 102-110: Farsi (fa)

---

## Technical Details

### File structure after refactor
```text
src/i18n/
  translations.ts          ← imports + re-exports composed object
  locales/
    sv.ts                  ← ~700 keys (already complete)
    en.ts                  ← ~700 keys (already complete)
    no.ts                  ← fill to ~700 keys
    da.ts                  ← fill to ~700 keys
    fi.ts                  ← fill to ~700 keys
    de.ts                  ← fill to ~700 keys
    fr.ts                  ← fill to ~700 keys
    es.ts                  ← fill to ~700 keys
    it.ts                  ← fill to ~700 keys
    pt.ts                  ← fill to ~700 keys
    nl.ts                  ← fill to ~700 keys
    pl.ts                  ← fill to ~700 keys
    ar.ts                  ← fill to ~700 keys (RTL)
    fa.ts                  ← fill to ~700 keys (RTL)
```

### Key count target
Every locale file must contain the exact same set of keys as `en.ts`. A build-time or test-time check can verify parity.

### Translation quality
- Use AI-assisted translation with native-quality output
- Preserve placeholders like `{count}`, `{done}`, `{failed}`
- RTL languages (ar, fa) keep the same key structure; RTL layout is handled by CSS
- Currency/number formatting stays locale-aware via `getLocalizedPricing()`

### Edge functions
Edge functions (`style_chat`, `shopping_chat`, `summarize_day`, etc.) already use `LANG_CONFIG` mappings and respond in the user's language via AI prompts. No changes needed there.

### No new dependencies
All translations are static strings in TypeScript files. No runtime i18n library needed.

