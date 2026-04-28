## Wave 6 — Localization (14 locales)

### P32 — Extend langName maps to 14 locales

**Problem**
Several AI functions only support sv/en. Other 12 locales fall back to English: `mood_outfit`, `smart_shopping_list`, `wardrobe_aging`, `clone_outfit_dna`, `travel_capsule`.

**Fix**
Canonical lang name map (use consistently):
```typescript
const LANG_NAMES: Record<string, string> = {
  sv: "svenska", en: "English", no: "norsk", da: "dansk", fi: "suomi",
  de: "Deutsch", fr: "français", es: "español", it: "italiano",
  pt: "português", nl: "Nederlands", pl: "polski", ar: "العربية", fa: "فارسی",
};
const langName = LANG_NAMES[locale] || "English";
```
Copy this to each of the 5 functions (or export from a shared `_shared/lang-names.ts`).

**Files**
- `supabase/functions/mood_outfit/index.ts`
- `supabase/functions/smart_shopping_list/index.ts`
- `supabase/functions/wardrobe_aging/index.ts`
- `supabase/functions/clone_outfit_dna/index.ts`
- `supabase/functions/travel_capsule/index.ts`
- `supabase/functions/_shared/lang-names.ts` (new, optional)

**Acceptance**
- Requesting locale=`de` returns German output (spot check)

**Deploy** 5 functions.

---

### P33 — Localize NotFound + Auth + ResetPassword

**Problem**
- `src/pages/NotFound.tsx` — entirely English ("404", "Page not found", "Return to Home")
- `src/pages/Auth.tsx` — hardcoded "you@email.com" placeholder
- `src/pages/ResetPassword.tsx` — hardcoded "••••••••" placeholder

**Fix**
1. Add keys to `src/i18n/locales/en.ts` and `sv.ts` (append-only rule — add new keys at END):
```typescript
// en.ts
'errors.404.title': '404',
'errors.404.body': 'Page not found',
'errors.404.cta': 'Return to Home',
'auth.email_placeholder': 'you@email.com',
'auth.password_placeholder': '••••••••',

// sv.ts — Swedish equivalents
'errors.404.title': '404',
'errors.404.body': 'Sidan hittades inte',
'errors.404.cta': 'Tillbaka till hem',
'auth.email_placeholder': 'du@email.com',
'auth.password_placeholder': '••••••••',
```
2. Replace hardcoded strings with `t('errors.404.title')` etc.
3. Apply to other 12 locales following the same pattern.

**Files**
- `src/pages/NotFound.tsx`
- `src/pages/Auth.tsx`
- `src/pages/ResetPassword.tsx`
- `src/i18n/locales/*.ts` (14 files)

**Acceptance**
- 404 page renders in user's locale
- Auth/ResetPassword placeholders match locale

**Deploy** None.

---

### P34 — Localize ShareOutfit + PublicProfile meta tags

**Problem**
og:title/description + meta description are hardcoded English in both pages.

**Fix**
Use i18n keys + template interpolation:
```typescript
// ShareOutfit.tsx
<meta property="og:title" content={t('share.og_title', { occasion: outfit.occasion })} />
<meta property="og:description" content={outfit.explanation || t('share.og_fallback')} />
```
Add keys to 14 locale files.

**Files**
- `src/pages/ShareOutfit.tsx`
- `src/pages/PublicProfile.tsx`
- `src/i18n/locales/*.ts`

**Acceptance**
- OG tags render in locale at page load time (note: bots may see default locale — that's OK)

**Deploy** None.

---

### P35 — Localize AddGarment + LiveScan + OutfitDetail + Onboarding fallbacks

**Problem**
Multiple hardcoded English/Swedish fallback strings across these pages.

**Fix**
Grep each file for string literals, add i18n keys for every one, replace with `t(...)` calls.

Specific strings to localize:
- `AddGarment.tsx`: `processingLabel="Reviewing garment details"`, `'Old garment replaced'`
- `LiveScan.tsx`: `'Locking on…'`, `'Reading garment…'`, `'Extracting details…'`, `'Focus on one garment'`
- `OutfitDetail.tsx`: Swedish `'vardag'` fallback → i18n key
- `Onboarding.tsx`: `'Step 01 of 04'` format, `'smart-casual'` fallback

**Files**
- 4 page files
- 14 locale files

**Acceptance**
- No hardcoded English or Swedish strings remain in those 4 files (grep verify)

**Deploy** None.

---

### P36 — Localize Insights.tsx

**Problem**
- Weekday labels `['M', 'T', 'W', 'T', 'F', 'S', 'S']` hardcoded English
- Radar axis labels hardcoded English: 'Variety', 'Color', 'Usage', 'Season', 'Value', 'Fit'
- `eyebrow="INSIGHTS"` hardcoded
- Fallback title 'Your Style Story' hardcoded

**Fix**
1. Weekday labels via date-fns locale:
```typescript
import { getDay, format, startOfWeek, addDays } from 'date-fns';
import { sv, enGB, de, fr, es, it, pt, nl, da, fi, nb, ar, fa, pl } from 'date-fns/locale';
const localeMap = { sv, en: enGB, de, fr, es, it, pt, nl, da, fi, no: nb, ar, fa, pl };
const dfnsLocale = localeMap[locale] || enGB;
const weekStart = startOfWeek(new Date(), { locale: dfnsLocale });
const days = Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'EEEEEE', { locale: dfnsLocale }));
```
2. Axis labels → i18n keys.
3. Eyebrow → i18n key.
4. Fallback title → i18n key.

**Files**
- `src/pages/Insights.tsx`
- `src/i18n/locales/*.ts`

**Acceptance**
- Weekday abbrevs render per locale (e.g. German "Mo Di Mi Do Fr Sa So")
- Axis labels localized

**Deploy** None.

---

### P37 — Localize MoodOutfit MOODS + MOOD_MAP

**Problem**
- `src/pages/MoodOutfit.tsx` MOODS array has English `hint` strings ("Sharp. Owned.", etc.)
- `supabase/functions/mood_outfit/index.ts` MOOD_MAP has English keys

**Fix**
1. Frontend: replace `hint: 'Sharp. Owned.'` with `hintKey: 'mood.confident.hint'`. Use `t(hintKey)` in render.
2. Add `mood.<key>.hint` keys to 14 locale files.
3. Edge function MOOD_MAP keys (`cozy`, `confident`, etc.) stay English (they're internal IDs). But the mood NAMES sent to Gemini in prompts should use the user's locale + system prompt tells Gemini to respond in that locale.

**Files**
- `src/pages/MoodOutfit.tsx`
- `supabase/functions/mood_outfit/index.ts` (prompt phrasing)
- `src/i18n/locales/*.ts`

**Acceptance**
- Each mood tile shows locale-specific hint
- AI response text in user's locale

**Deploy** `mood_outfit`

---

### P38 — Extend token lists to all 14 locales

**Problem**
`_shared/outfit-rules.ts`, `_shared/burs-slots.ts`, `_shared/travel-capsule-planner.ts` have classification token lists that only include English + Swedish. Other locales' category keywords never match, causing misclassification.

**Fix**
For each module's token arrays, add equivalents in 12 more locales. Example for `SHOES_TOKENS`:
```typescript
const SHOES_TOKENS: readonly string[] = [
  // English
  'shoes', 'shoe', 'sneakers', 'boots', 'loafers', 'sandals', 'heels', 'footwear',
  // Swedish
  'skor', 'stövlar',
  // Norwegian
  'sko', 'støvler',
  // Danish
  'sko', 'støvler',
  // Finnish
  'kengät', 'saappaat',
  // German
  'schuhe', 'stiefel',
  // French
  'chaussures', 'bottes',
  // Spanish
  'zapatos', 'botas',
  // Italian
  'scarpe', 'stivali',
  // Portuguese
  'sapatos', 'botas',
  // Dutch
  'schoenen', 'laarzen',
  // Polish
  'buty', 'kozaki',
  // Arabic
  'أحذية',
  // Persian
  'کفش',
];
```
Repeat for top/bottom/outerwear/dress/accessory tokens across all 3 files.

**Files**
- `supabase/functions/_shared/outfit-rules.ts`
- `supabase/functions/_shared/burs-slots.ts`
- `supabase/functions/_shared/travel-capsule-planner.ts`

**Acceptance**
- Garments with non-English category names classify correctly
- Classify test: feed 10 German/French/Japanese category strings, all return correct slot

**Deploy** Every AI function importing these modules (shared file deploy map in CLAUDE.md — ~20 functions). Batch across sessions.

---

### P39 — Localize day-intelligence.ts OCCASION_RULES

**Problem**
`_shared/day-intelligence.ts` OCCASION_RULES tag arrays are English-only. Non-English calendar events never match, always fallback to `remote` occasion.

**Fix**
Extend each rule's `tags` array with translations:
```typescript
{ occasion: 'work', formality: 4, confidence: 0.9, tags: [
  // English
  'boardroom', 'client', 'presentation', 'interview', 'pitch', 'office', 'meeting',
  // Swedish
  'kontor', 'möte', 'presentation',
  // German
  'büro', 'besprechung', 'präsentation',
  // French
  'bureau', 'réunion', 'présentation',
  // ... etc for all 14 locales
]},
```

Alternative: externalize tags to a JSON file per locale, load based on user.preferences.locale.

**Files**
- `supabase/functions/_shared/day-intelligence.ts`

**Acceptance**
- Calendar event "Möte med klient" (Swedish) classifies as `work`, not `remote`
- Test across 5+ locales

**Deploy** Every function importing day-intelligence.

---

### P40 — Multi-locale regexes

**Problem**
- `src/pages/OutfitGenerate.tsx` `FORMAL_KEYWORDS` regex is English-only
- `supabase/functions/shopping_chat/index.ts` `CHAT_SHORT_RE` regex matches only English greetings

**Fix**
Combine patterns across locales:
```typescript
// OutfitGenerate.tsx
const FORMAL_KEYWORDS = /\b(meeting|presentation|conference|interview|client|dinner|lunch|board|pitch|wedding|formal|work|office|möte|präsentation|réunion|besprechung|entrevista|colloquio|reünie|spotkanie)\b/i;

// shopping_chat/index.ts
const CHAT_SHORT_RE = /^(hi|hello|hey|thanks|thank you|bye|hej|tack|hallo|danke|bonjour|merci|hola|gracias|ciao|grazie|oi|obrigado|dzień dobry|dziękuję|مرحبا|شكرا|سلام|ممنون)\s*[!.?]*$/i;
```

**Files**
- `src/pages/OutfitGenerate.tsx`
- `supabase/functions/shopping_chat/index.ts`

**Acceptance**
- Formal detection works in all supported locales
- Short greeting fast-path fires for all locales

**Deploy** `shopping_chat`

---

### P41 — Fix UnusedOutfits Swedish/English mixing

**Problem**
`src/pages/UnusedOutfits.tsx` `OCCASIONS = ['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual']` — mixes Swedish ('vardag', 'jobb') and English ('casual').

**Fix**
Decide canonical: either ALL i18n keys (e.g. `'occasion.daily'`) resolved via `t()`, OR ALL canonical English keys with UI translation. Align with rest of codebase (check how `getOccasionLabel` normalizes).

**Files**
- `src/pages/UnusedOutfits.tsx`

**Acceptance**
- No language mixing
- UI shows occasion in user's locale

**Deploy** None.

---

