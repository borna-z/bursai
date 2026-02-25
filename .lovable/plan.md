

## Plan: Update all email references from `hello@burs.com` to `hello@burs.me`

### Scope
4 files contain `hello@burs.com` references that need updating:

| File | Occurrences |
|------|-------------|
| `src/pages/marketing/PrivacyPolicy.tsx` | ~12 (mailto + display text) |
| `src/pages/marketing/Terms.tsx` | ~4 |
| `public/privacy/index.html` | ~12 |
| `public/terms/index.html` | ~4 |

### Changes
Simple find-and-replace in all 4 files: every instance of `hello@burs.com` becomes `hello@burs.me`. This includes both `mailto:` hrefs and visible display text.

No other files or logic are affected.

