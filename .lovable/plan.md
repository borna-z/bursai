

## Remove All Hardcoded Language Strings

A thorough audit found hardcoded Swedish (and some English) strings in **10+ files** across the frontend. Here is every file and what needs to change.

---

### 1. `src/components/plan/MiniDayCard.tsx`
- Line 30: `'Idag'` and `'Imorgon'` hardcoded instead of `t('plan.today')` / `t('plan.tomorrow')`

### 2. `src/components/plan/PreselectDateSheet.tsx`
- Line 30-31: `'Idag'` and `'Imorgon'` hardcoded instead of `t('plan.today')` / `t('plan.tomorrow')`
- Needs `useLanguage` import and hook call

### 3. `src/hooks/useWeather.ts`
- Line 51: `accept-language=sv` hardcoded -- should use the current locale dynamically
- Lines 53, 55, 57: `'Din plats'` hardcoded -- should return a translation key or use locale

### 4. `src/hooks/useCalendarSync.ts`
- Line 7: `import { sv } from 'date-fns/locale'` -- remove
- Line 77: `Synkade ${data.synced} handelser` -- use translation key with interpolation
- Line 80: `'Kunde inte synka kalendern'` -- use `t()` key
- Line 97: `Synkade ${data.synced} handelser fran Google` -- use translation key
- Line 100: `'Kunde inte synka Google Calendar'` -- use `t()` key
- Line 108: `'Ej inloggad'` -- use translation key
- Line 119: `'Kunde inte spara kalender-URL'` -- use translation key
- Line 141: `'Kalendersynk borttagen'` -- use translation key
- Line 144: `'Kunde inte ta bort kalendersynk'` -- use translation key
- Line 156, 162: `'Kunde inte starta Google-koppling'` -- use translation key
- Line 178: `'Google Calendar bortkopplad'` -- use translation key
- Line 181: `'Kunde inte koppla bort Google Calendar'` -- use translation key
- Line 281-282: `{ locale: sv }` and `'Kalendern synkades automatiskt'` -- use current locale and translation key

**Challenge**: `useCalendarSync` is a hook, not a component. It cannot call `useLanguage()` directly since it's already a hook. Solution: Accept a `t` function parameter, or import `useLanguage` (hooks can call other hooks).

### 5. `src/components/wardrobe/QuickEditPanel.tsx`
- Line 13: `colorOptions` array with Swedish color names (`'svart'`, `'vit'`, `'gra'`, etc.)
- Line 49: `'Uppdaterat!'` toast
- Line 52: `'Kunde inte spara'` toast
- Line 76: `'Ny'` badge text
- Lines 104-108: `'Overdel'`, `'Underdel'`, `'Skor'`, `'Ytter'`, `'Acc.'` -- category labels
- Line 130: `'Formalitet:'` label
- Line 177: `'Snabbredigera'` title
- Lines 183-184: `'Justera kategori, farg och formalitet for dina nya plagg'` description
- Line 197: `'+{n} fler plagg'` text

### 6. `src/components/LinkImportForm.tsx`
- Lines 105, 113, 117, 123: Error/fallback strings (`'Import misslyckades'`, `'Plagg importerat'`, `'Okant fel'`, `'Kunde inte importera'`)
- Line 140: `'Importerade ${n} plagg'` toast
- Line 142: `'Visa garderob'` action label
- Line 149: `'${n} misslyckades'` toast
- Lines 150-151, 153: `'Tryck for att se detaljer'`, `'Visa detaljer'`
- Lines 172-183: Status labels (`'Vantar'`, `'Importerar...'`, `'Klar'`, `'Misslyckades'`)
- Line 211: `'Klistra in produktlankar (en per rad)'` label
- Line 214: `'lankar'` text
- Lines 228-236: Limit/error messages in Swedish
- Line 244: `'Vissa sajter kan blockera...'` info text
- Lines 258, 263, 274: Button/progress text in Swedish
- Lines 308, 322: `'Misslyckade importeringar:'`, `'Stang'`

### 7. `src/pages/GoogleCalendarCallback.tsx`
- Line 18: `'Du nekade atkomst till Google Calendar.'`
- Line 24: `'Ingen auktoriseringskod mottagen.'`
- Line 50: `'Kunde inte koppla Google Calendar. Forsok igen.'`
- Line 63: `'Kopplar Google Calendar...'`
- Line 64: `'Vanta medan vi synkar dina handelser'`
- Line 70: `'Google Calendar kopplad!'`
- Line 71: `'Omdirigerar till installningar...'`
- Line 77: `'Nagot gick fel'`
- Line 83: `'Tillbaka till installningar'`

### 8. `src/pages/marketing/Admin.tsx`
- Lines 147, 159, 171: `'Sidvisningar'`, `'Leads'`, `'App-klick'`
- Line 183: `'Handelser'`
- Line 206: `'Sok email...'`
- Line 225-227: Table headers `'Email'`, `'Kalla'`, `'UTM'`, `'Datum'`
- Line 239: `toLocaleDateString('sv-SE')` hardcoded
- Line 248: `'Inga leads hittades'`

### 9. `src/pages/AddGarment.tsx`
- Lines 52-58: `subcategories` arrays with Swedish names (`'T-shirt'`, `'Skjorta'`, `'Jacka'`, etc.) -- these need translation keys
- Lines 62-75: `colors` array with Swedish labels (`'Svart'`, `'Vit'`, etc.)
- Lines 77-80: `patterns`, `materials`, `fits`, `seasons` arrays with Swedish display names
- Line 529: Subcategory items rendered without `t()` call

### 10. `src/pages/Landing.tsx`
- The entire landing page has English strings hardcoded directly in JSX (not going through `t()`). This is acceptable if the landing page is intentionally English-only, but if it should be translatable, all strings need keys.

---

### Implementation approach

1. **Add ~80-100 new translation keys** to `src/i18n/translations.ts` for sv, en, and no (other languages fall back to English/Swedish).

2. **Update each file** to import `useLanguage` and wrap hardcoded strings in `t()`.

3. **For hooks** (`useCalendarSync`, `useWeather`): Since hooks can call other hooks, add `useLanguage()` inside these hooks. For `useWeather`'s `getCityName`, pass the locale to the `accept-language` header.

4. **For data arrays** (colors, subcategories, patterns in AddGarment and QuickEditPanel): Create translation key maps similar to the existing `CATEGORY_I18N` pattern and wrap display labels in `t()`.

5. **Admin page**: Add translation keys for admin-specific labels (lower priority since it's internal).

### Scope note
- Edge functions (Supabase) contain Swedish strings too (e.g., `style_chat`, `shopping_chat`, `summarize_day`), but these are AI system prompts that intentionally respond in Swedish. These should remain as-is unless multi-language AI responses are desired.
- The Landing page uses English strings directly in JSX. These could be left as-is if the landing page is English-only by design.
