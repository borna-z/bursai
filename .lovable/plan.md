
# Fullstandig i18n-granskning: Alla hardkodade strangar ska bort

## Sammanfattning

En grundlig genomgang av hela appen har identifierat **hardkodade strangar och datumsformatering** som inte ar oversattbara. Problemet beror pa tva saker:

1. **Datum/dagar formateras med `date-fns` `format()` eller `toLocaleDateString(undefined, ...)` utan att skicka in aktuell locale** -- sa dagar visas alltid pa systemspraket (oftast svenska/engelska) istallet for det valda spraket.
2. **Flera sidor (Landing, Terms, Privacy) har all text pa engelska direkt i komponenterna.**
3. **Enstaka hardkodade svenska strängar i komponentkod** (t.ex. `'Vardag'`, `'Skapad fran stylistens forslag'` i AIChat).
4. **Fargnamn, sakongnamn etc i Wardrobe-filtren visas hardkodade** (`'svart'`, `'vit'`, `'var'`, `'sommar'` etc.)

---

## Del 1: Datum- och dagformatering (hogst prioritet -- synligaste buggen)

Alla `toLocaleDateString(undefined, ...)`, `format(date, 'EEE')`, `format(date, 'd MMM')`, och `format(date, 'EEEE d MMMM')` ska anvanda anviandarens valda locale.

### Fil: `src/components/plan/WeekStrip.tsx`
- Rad 49: `format(date, 'EEE').slice(0, 2)` -- date-fns `format` defaults till engelska. Ska andras till `format(date, 'EEE', { locale: dateFnsLocale }).slice(0, 2)`.
- Behover importera `useLanguage` och en locale-mapper.

### Fil: `src/components/weather/WeatherWidget.tsx`
- Rad 43: `dayDate.toLocaleDateString(undefined, { weekday: 'short' })` -- `undefined` fallback. Ska anvanda den korrekta BCP47 locale-stangen fran `useLanguage`.

### Fil: `src/pages/Plan.tsx`
- Rad 105: `format(selectedDate, 'EEEE d MMMM')` -- hardkodad date-fns format utan locale.

### Fil: `src/components/plan/MiniDayCard.tsx`
- Rad 31: `date.toLocaleDateString(undefined, ...)`.

### Fil: `src/components/plan/DayCard.tsx`
- Rad 60: `date.toLocaleDateString(undefined, ...)`.

### Fil: `src/components/plan/QuickPlanSheet.tsx`
- Rad 33: `date.toLocaleDateString(undefined, { weekday: 'long' })`.

### Fil: `src/components/plan/QuickGenerateSheet.tsx`
- Rad 119: `date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })`.

### Fil: `src/components/plan/PlanningSheet.tsx`
- Rad 42: `date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })`.

### Fil: `src/components/plan/PreselectDateSheet.tsx`
- Rad 34: `date.toLocaleDateString(undefined, ...)`.

### Fil: `src/components/outfit/PlannedOutfitsList.tsx`
- Rad 120: `date.toLocaleDateString(undefined, ...)`.

### Fil: `src/pages/Outfits.tsx`
- Rad 59-62: `format(new Date(...), 'd MMM')`.

### Fil: `src/components/wardrobe/OutfitReel.tsx`
- Rad 215: `format(new Date(...), 'd MMM yyyy')`.

### Fil: `src/components/wardrobe/WardrobeOutfitsTab.tsx`
- Rad 50: `format(new Date(...), 'd MMM')`.

### Fil: `src/pages/GarmentDetail.tsx`
- Rad 154: `toLocaleDateString(undefined, ...)`.
- Rad 181: `toLocaleDateString(undefined)`.

### Losning: Ny hjalpfunktion + date-fns locale-map

Skapa en ny util `src/lib/dateLocale.ts`:
- Exporterar en funktion `getDateFnsLocale(locale: Locale)` som mappar var locale till date-fns locale-objekt.
- Exporterar en funktion `getBCP47(locale: Locale): string` som mappar till BCP47-strang for `toLocaleDateString()`.
- Behover installera `date-fns/locale` (ingar redan i date-fns).

Sedan uppdatera alla filer ovan for att:
1. `toLocaleDateString(getBCP47(locale), ...)` istallet for `toLocaleDateString(undefined, ...)`.
2. `format(date, 'pattern', { locale: getDateFnsLocale(locale) })` istallet for `format(date, 'pattern')`.

---

## Del 2: Hardkodade strängar i Wardrobe-filter

### Fil: `src/pages/Wardrobe.tsx`
- Rad 26: `colorFilters = ['svart', 'vit', 'gra', ...]` -- visas direkt. Ska anvanda `COLOR_I18N` mapping med `t()`.
- Rad 27: `seasonFilters = ['var', 'sommar', 'host', 'vinter']` -- visas direkt. Ska anvanda `SEASON_I18N` mapping med `t()`.
- Raderna 333-335 och 355: `{color}` och `{season}` visas direkt utan oversattning.

### Losning
Importera `COLOR_I18N` och `SEASON_I18N` (redan definierade i AddGarment) och anvand `t(COLOR_I18N[color] || color)` och `t(SEASON_I18N[season] || season)` vid rendering.

---

## Del 3: Hardkodade strangar i AIChat

### Fil: `src/pages/AIChat.tsx`
- Rad 257: `{ occasion: 'Vardag', explanation: 'Skapad fran stylistens forslag' }` -- hardkodade svenska strängar.
- Rad 261: `'Outfit skapad!'` fallback.
- Rad 263: `'Kunde inte skapa outfit'` fallback.

### Losning
Anvand `t()` for alla dessa.

---

## Del 4: GarmentDetail -- hardkodade attributvarden

### Fil: `src/pages/GarmentDetail.tsx`
- Rad 111: `{garment.subcategory || garment.category}` -- visas ra (t.ex. "top", "svart").
- Rad 114-119: Badges visar `garment.color_primary`, `garment.pattern`, `garment.material`, `garment.fit`, `garment.season_tags` ratt fran databasen utan oversattning.

### Losning
Anvand I18N-mappings (COLOR_I18N, PATTERN_I18N, MATERIAL_I18N, FIT_I18N, SEASON_I18N, CATEGORY_I18N, SUBCATEGORY_I18N) med `t()` for att visa oversatta varden.

---

## Del 5: QuickGenerateSheet hardkodad streng

### Fil: `src/components/plan/QuickGenerateSheet.tsx`
- Rad 68: `{ id: 'street', label: 'Street' }` -- hardkodat utan `t()`.

### Losning
Anvand `t('home.style.street')`.

---

## Del 6: Landing, Terms, PrivacyPolicy -- helt hardkodad engelska

### Fil: `src/pages/Landing.tsx`
Alla texter ar pa engelska direkt i komponentkoden ("How it works", "Log In", "Get Started", "Sustainability", etc.). Ca 50+ strängar.

### Fil: `src/pages/marketing/Terms.tsx`
Alla TERMS.sections ar pa engelska. Footer-lankar ("Privacy Policy", "Terms", "Contact") ar hardkodade.

### Fil: `src/pages/marketing/PrivacyPolicy.tsx`
Alla PRIVACY.sections ar pa engelska. Footer-lankar och "Contact" sektionen ar hardkodade.

### Losning
Lagga till alla Landing/Terms/Privacy-strängar i `translations.ts` och anvanda `t()` overallt. Notera att detta ar marketing-sidor och kan behandlas som lagre prioritet an app-flode.

---

## Del 7: PlanningSheet occasion-badge

### Fil: `src/components/plan/PlanningSheet.tsx`
- Rad 90: `{outfit.occasion}` visas direkt utan oversattning i badges.

### Fil: `src/components/wardrobe/WardrobeOutfitsTab.tsx`
- Rad 41: `{outfit.occasion}` visas direkt.

### Fil: `src/pages/ShareOutfit.tsx`
- Rad 145: `{outfit.occasion}` visas direkt.

### Losning
Anvanda OCCASION_I18N-mapping for att oversatta occasion.

---

## Del 8: Oversattningsfilen

### Fil: `src/i18n/translations.ts`
Alla nya nycklar som laggs till i sv maste aven laggas till i alla 13 ovriga sprak (en, no, da, fi, de, fr, es, it, pt, nl, pl, ar, fa).

---

## Teknisk plan -- filer som andras

| # | Fil | Andringar |
|---|-----|-----------|
| 1 | `src/lib/dateLocale.ts` | **NY FIL** -- date-fns locale mapper + BCP47 mapper |
| 2 | `src/components/plan/WeekStrip.tsx` | Locale-aware date-fns format |
| 3 | `src/components/weather/WeatherWidget.tsx` | Locale-aware toLocaleDateString |
| 4 | `src/pages/Plan.tsx` | Locale-aware date-fns format |
| 5 | `src/components/plan/MiniDayCard.tsx` | Locale-aware toLocaleDateString |
| 6 | `src/components/plan/DayCard.tsx` | Locale-aware toLocaleDateString |
| 7 | `src/components/plan/QuickPlanSheet.tsx` | Locale-aware toLocaleDateString |
| 8 | `src/components/plan/QuickGenerateSheet.tsx` | Locale-aware toLocaleDateString + fix Street-label |
| 9 | `src/components/plan/PlanningSheet.tsx` | Locale-aware date + occasion t() |
| 10 | `src/components/plan/PreselectDateSheet.tsx` | Locale-aware toLocaleDateString |
| 11 | `src/components/outfit/PlannedOutfitsList.tsx` | Locale-aware toLocaleDateString |
| 12 | `src/pages/Outfits.tsx` | Locale-aware date-fns format |
| 13 | `src/components/wardrobe/OutfitReel.tsx` | Locale-aware date-fns format |
| 14 | `src/components/wardrobe/WardrobeOutfitsTab.tsx` | Locale-aware date + occasion t() |
| 15 | `src/pages/GarmentDetail.tsx` | Locale-aware date + translated attributes |
| 16 | `src/pages/Wardrobe.tsx` | Color/season filter labels via t() |
| 17 | `src/pages/AIChat.tsx` | Hardkodade strängar -> t() |
| 18 | `src/pages/ShareOutfit.tsx` | Occasion -> t() |
| 19 | `src/pages/Landing.tsx` | Alla strangar -> t() + nya nycklar |
| 20 | `src/pages/marketing/Terms.tsx` | Alla strangar -> t() + nya nycklar |
| 21 | `src/pages/marketing/PrivacyPolicy.tsx` | Alla strangar -> t() + nya nycklar |
| 22 | `src/i18n/translations.ts` | Nya nycklar for datum, landing, terms, privacy + alla 14 sprak |

Totalt: **1 ny fil + 21 redigerade filer**
