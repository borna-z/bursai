# N16 — i18n closeout + auto-classify

| Field | Value |
|---|---|
| Goal | Close the three pre-launch i18n / hardcoded-stub gaps surfaced by the 2026-05-11 audit and the N15 deferral list: (1) `summarize_day` pins output to English regardless of user locale; (2) ~15 mobile call sites still ship raw English strings outside the `tr()` system; (3) `import_garments_from_links` inserts hardcoded `category='top'` + `color_primary='grey'` instead of running real classification. |
| Status | DONE (PR #821, 2026-05-11) |
| Branch | `mobile-n16-i18n-closeout` |
| PR count | 1 |
| Depends on | N15 (clean main) |
| Complexity | M (1 edge-function locale change + 1 edge-function classification rewrite + 1 mobile hook tweak + ~15 string call-sites + locale key appends) |

## Background

The 2026-05-11 N-wave roadmap parked three "i18n closeout" items in the N16 slot:

- **summarize_day pins English.** `supabase/functions/summarize_day/index.ts:79` hardcodes the system prompt with `"Always respond in English regardless of the language of the calendar event titles."` Swedish users running Sweden Day-1 will get an English `summary` line in the SmartDayBanner even with their device set to `sv`. The function already supports a per-user cache namespace; adding a `locale` body field + locale-keyed cache is a small change. The mobile caller (`useDaySummary.ts`) currently doesn't pass `locale`; needs a one-line addition.
- **Mobile hardcoded English hold-outs.** `M33` + `N8` swept most surfaces, but a handful of Alert.alert call sites and `<Text>` strings still ship raw English. Concrete sites verified during scoping: `GarmentDetailScreen.tsx` (5 alerts + "Studio" badge), `LaundryScreen.tsx` (1 alert), `LiveScanScreen.tsx` (4 alerts), `OutfitDetailScreen.header.tsx` (1 alert), `FiltersScreen.tsx` ("Cancel" button), `TravelCapsuleScreen.datePicker.tsx` ("Cancel" button), `GarmentCard.tsx` ("Laundry" badge). Total ~15 strings.
- **import_garments_from_links auto-classify.** `supabase/functions/import_garments_from_links/index.ts:462-466` inserts every imported garment with `category: 'top'` and `color_primary: 'grey'` as hardcoded defaults — direct violation of the standing "no hardcoded fake info / inputs / stubs" rule (memory `feedback-no-hardcoded-stubs.md`, 2026-05-08). A Swedish user importing a black dress from Zalando gets a "top / grey" garment, requiring two manual edits per import. The function already downloads the image; calling the existing `analyze_garment` AI path with the image bytes gives real category/color/subcategory/material/season/formality.

`generate_flatlay` is **dropped from N16 scope per 2026-05-11 user direction** (memory `project-flatlay-deprecated.md` — "flat lay generation we do not need").

## Items

### Code-only (no migration)

| ID | Description |
|---|---|
| **N16-1** | `summarize_day/index.ts` — accept optional `locale` body field. System prompt: replace the English-pin sentence with locale-aware instruction (`"Respond in <locale-name>. Event titles may be in any language — interpret them but always write your output in the user's locale."`). Fold `locale` into `cacheNamespace` so a user who switches device language gets a fresh summary instead of cached English. Default to `'en'` when the body omits it. |
| **N16-2** | `mobile/src/hooks/useDaySummary.ts` — pass `locale: getCurrentLocale()` (or equivalent, see `mobile/src/lib/i18n.ts`) in the edge function body; fold it into the React Query `queryKey` so locale changes re-fetch instead of serving stale English. |
| **N16-3** | Mobile hardcoded English sweep — replace the ~15 raw strings with `tr()` calls. New keys appended to `mobile/src/i18n/locales/en.ts` and `mobile/src/i18n/locales/sv.ts` (the only two locales we have full coverage on). Per CLAUDE.md the locale files are append-only. Keyspace: `garmentDetail.alerts.*`, `garmentDetail.badge.studio`, `laundry.alerts.markAllClean.*`, `livescan.alerts.*`, `outfitDetail.menu.options`, `common.cancel`, `garmentCard.badge.laundry`. |
| **N16-4** | `import_garments_from_links/index.ts` — after the image bytes are downloaded (line ~419), before the `garments` INSERT, call `analyze_garment` via a service-role fetch with `{ base64Image, locale, mode: 'fast' }`. Use the returned `category`, `subcategory`, `color_primary`, `color_secondary`, `pattern`, `material`, `fit`, `season_tags`, `formality` to populate the INSERT. On `analyze_garment` failure (timeout, rate-limit, AI error): fall back to inserting with the metadata title only, and stamp `enrichment_status='failed'` so the existing client-side retry UX kicks in. Pass the user's locale through so the title is localized. |

## Files touched

### Modified
- `supabase/functions/summarize_day/index.ts` — N16-1
- `supabase/functions/import_garments_from_links/index.ts` — N16-4
- `mobile/src/hooks/useDaySummary.ts` — N16-2
- `mobile/src/screens/GarmentDetailScreen.tsx` — N16-3
- `mobile/src/screens/LaundryScreen.tsx` — N16-3
- `mobile/src/screens/LiveScanScreen.tsx` — N16-3
- `mobile/src/screens/OutfitDetailScreen.header.tsx` — N16-3
- `mobile/src/screens/FiltersScreen.tsx` — N16-3
- `mobile/src/screens/TravelCapsuleScreen.datePicker.tsx` — N16-3
- `mobile/src/components/GarmentCard.tsx` — N16-3
- `mobile/src/i18n/locales/en.ts` — N16-3 (append-only)
- `mobile/src/i18n/locales/sv.ts` — N16-3 (append-only)

## Method

Smallest viable diff per item. No migrations. No new edge functions. No new shared primitives.

### N16-1 detail

In `summarize_day/index.ts`:

```ts
const { events, weather, locale } = await req.json();
const userLocale = typeof locale === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : 'en';

const LOCALE_NAMES: Record<string, string> = {
  en: 'English', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  de: 'German', fr: 'French', es: 'Spanish', pt: 'Portuguese', it: 'Italian',
  nl: 'Dutch',
};
const localeName = LOCALE_NAMES[userLocale.split('-')[0]] ?? 'English';

const systemPrompt = `${VOICE_DAY_SUMMARY}\n\nRespond in ${localeName}. Event titles may be in any language — interpret them but always write your output in ${localeName}.`;
```

Cache namespace becomes `summarize_day_${user.id}_${userLocale}_${eventsCacheKey}`. Locale validation regex blocks tag-injection through cache key.

### N16-2 detail

`mobile/src/hooks/useDaySummary.ts`:

```ts
import { getCurrentLocale } from '../lib/i18n';
const locale = getCurrentLocale();
// ...
queryKey: ['daySummary', user?.id, dayKey, locale, eventsHash, weatherHash],
queryFn: async () => {
  const result = await callEdgeFunction<SummarizeDayResponse>('summarize_day', {
    body: { events, weather, locale },
    retries: 1,
    timeoutMs: 30_000,
  });
  return result ?? { summary: null };
},
```

If `getCurrentLocale` doesn't exist verbatim, use the public locale getter that `tr()` already consumes (verify in `mobile/src/lib/i18n.ts`).

### N16-3 detail

For each of the ~15 sites, replace the raw string with `tr('<namespace>.<key>')` and append the key to both `en.ts` and `sv.ts`. Append-only — never reorder existing keys.

Key plan (English source / Swedish translation):

| Key | en.ts | sv.ts |
|---|---|---|
| `garmentDetail.alerts.couldNotLogWear.title` | `Could not log wear` | `Kunde inte logga användning` |
| `garmentDetail.alerts.couldNotLogWear.tryAgain` | `Try again.` | `Försök igen.` |
| `garmentDetail.alerts.couldNotMove.title` | `Could not move` | `Kunde inte flytta` |
| `garmentDetail.alerts.delete.title` | `Delete` | `Ta bort` |
| `garmentDetail.alerts.delete.body` | `Delete this garment? This cannot be undone.` | `Ta bort detta plagg? Detta kan inte ångras.` |
| `garmentDetail.alerts.deleteFailed.title` | `Delete failed` | `Borttagning misslyckades` |
| `garmentDetail.alerts.options.title` | `Options` | `Alternativ` |
| `garmentDetail.badge.studio` | `Studio` | `Studio` |
| `laundry.alerts.markAllClean.title` | `Mark all clean?` | `Markera alla som rena?` |
| `laundry.alerts.markAllClean.body` | `{count} pieces will be moved out of laundry.` | `{count} plagg flyttas ut ur tvätten.` |
| `livescan.alerts.captureFailed.title` | `Capture failed` | `Inspelning misslyckades` |
| `livescan.alerts.captureFailed.body` | `Try again.` | `Försök igen.` |
| `livescan.alerts.permission.title` | `Permission needed` | `Behörighet krävs` |
| `livescan.alerts.permission.body` | `Grant photo access to import from your gallery.` | `Ge åtkomst till foton för att importera från ditt galleri.` |
| `livescan.alerts.galleryUnavailable.title` | `Gallery unavailable` | `Galleri ej tillgängligt` |
| `livescan.alerts.galleryUnavailable.body` | `Could not open the photo library.` | `Kunde inte öppna fotobiblioteket.` |
| `outfitDetail.menu.options` | `Options` | `Alternativ` |
| `common.cancel` | `Cancel` | `Avbryt` (verify not already present) |
| `garmentCard.badge.laundry` | `Laundry` | `Tvätt` |

For the `Mark all clean?` body, use the existing `tr()` interpolation convention (verify in `mobile/src/lib/i18n.ts`; usual pattern is `tr('key', { count })` with `{count}` placeholder in the string).

### N16-4 detail

In `import_garments_from_links/index.ts`, after `const imageResult = await downloadImage(metadata.imageUrl);` succeeds and before the storage upload:

```ts
// Convert downloaded bytes to base64 for analyze_garment
const base64Image = btoa(String.fromCharCode(...imageResult.data));

// Call analyze_garment via service-role fetch — same Supabase project
let analysis: GarmentAnalysisResult | null = null;
try {
  const analyzeRes = await fetch(`${supabaseUrl}/functions/v1/analyze_garment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,        // pass through user JWT for auth + rate-limit
    },
    body: JSON.stringify({
      base64Image,
      locale: body.locale ?? 'en',
      mode: 'fast',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (analyzeRes.ok) {
    analysis = await analyzeRes.json();
  }
} catch (err) {
  console.warn('analyze_garment failed, falling back to metadata-only insert:', err);
}
```

Replace the hardcoded INSERT fields:

```ts
.insert({
  id: garmentId,
  user_id: user.id,
  image_path: imagePath,
  title: (analysis?.title || metadata.title || 'Imported garment').substring(0, 200),
  category: analysis?.category ?? 'top',
  subcategory: analysis?.subcategory ?? null,
  color_primary: analysis?.color_primary ?? 'grey',
  color_secondary: analysis?.color_secondary ?? null,
  pattern: analysis?.pattern ?? null,
  material: analysis?.material ?? null,
  fit: analysis?.fit ?? null,
  season_tags: analysis?.season_tags ?? [],
  formality: analysis?.formality ?? null,
  source_url: trimmedUrl,
  imported_via: 'link',
  enrichment_status: analysis ? 'complete' : 'failed',
})
```

Why pass-through JWT and not service-role: the user's own `analyze_garment` rate-limit and quota apply. Importing 30 URLs in one batch already burns 30 analyze_garment calls — acceptable per the user's existing 40/hr quota for that function. Service-role bypass would silently skip the per-user cost meter.

`ImportRequest` interface gets `locale?: string`. The mobile `ImportFromLinkScreen` already has `getCurrentLocale` available via `tr()` infra — wire it into the request body.

Acceptable fallback semantics: if analyze_garment fails (rate-limit, AI error, timeout), the garment still imports with `enrichment_status: 'failed'`, mirroring the existing batch-capture path. Client UI already surfaces failed enrichment per M1/M4.

## Acceptance gates

Run from repo root unless noted:

- `deno check supabase/functions/summarize_day/index.ts` — clean
- `deno check supabase/functions/import_garments_from_links/index.ts` — clean
- `cd mobile && npx tsc --noEmit` — 0 errors
- `cd mobile && npx eslint "src/**/*.{ts,tsx}" --max-warnings 0` — 0 warnings (the strict glob form per memory `reference-mobile-ci-gates.md`)
- `cd mobile && npx jest` — green
- `cd mobile && npx expo-doctor` — passes
- Migration drift check: `npx supabase migration list --linked` — no new migrations expected
- Manual smoke (post-deploy):
  - Set device locale to `sv`, open Home, observe SmartDayBanner summary returns Swedish text
  - Open AddPiece → Import from Links, paste a Zalando product URL, confirm category + color come back populated (not `top`/`grey`)
  - Trigger one alert in each of: GarmentDetail wear-log failure, Laundry "Mark all clean", LiveScan capture failure — confirm Swedish copy renders

## Deploy

Post-merge, deploy both modified edge functions one at a time:

```bash
npx supabase functions deploy summarize_day --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
npx supabase functions deploy import_garments_from_links --project-ref khvkwojtlkcvxjxztduj --no-verify-jwt
```

No migration. No cron change. No secret change.

## Anti-patterns

- Don't change `analyze_garment`'s signature — pass through existing `{ base64Image, locale, mode }` only.
- Don't introduce a new "import classification" RPC or shared helper — the inline service-role fetch is the smallest diff.
- Don't add new keys to the 11 non-{en,sv} locale files. Per the M33 deferral (Finding 15 in `findings-log.md`), the `dict[key] || en[key] || key` fallback gracefully degrades those locales until the v1.0.1 i18n top-up PR. Adding partial coverage now would create churn for the future translator pass.
- Don't reorder existing keys in `en.ts` / `sv.ts`. Append-only.
- Don't fold `generate_flatlay` model-bug fixes into this PR. Dropped per 2026-05-11 user direction.
- Don't change `import_garments_from_links`'s SSRF protection or batch limit (30 URLs) — orthogonal to the auto-classify fix.
- Don't service-role-bypass the analyze_garment rate-limit. Pass-through JWT preserves per-user quota.

## Out of scope (deferred to later N-waves)

- **N17** — GarmentDetail completeness (Outfits tab, Similar tab, multi-image, AI enrichment panel).
- **N18** — AI smartness (feedback loops, StyleProfile in mood/photo, prompt-injection sanitization).
- **N19** — Mobile a11y + Dynamic Type + perf.
- **N20** — Schema integrity sweep (search_path on ledger RPCs, outfit_items UNIQUE, analytics indexes, cross-FK ownership).
- **N21** — Wardrobe bulk ops + chat refine + image-share.
- **N22** — Post-launch hardening (SecureStore, pgsodium, user_subscriptions strangle).
