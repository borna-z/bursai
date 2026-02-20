

## Remove All Hardcoded Swedish -- Full i18n Coverage

### Problem
Many pages and components still contain hardcoded Swedish strings instead of using the `t()` translation function. This means switching language in settings has no effect on large parts of the UI.

### Scope
After a thorough audit, the following files contain hardcoded Swedish text that must be replaced with `t()` calls. New translation keys will be added to `src/i18n/translations.ts` for all 12+ supported locales.

---

### Files to Update (14 files)

**Settings pages (5 files):**

| File | Hardcoded strings |
|------|------------------|
| `src/pages/Settings.tsx` | "Utseende", "Tema, accentfarg, sprak", "Stil", "Kroppsmatt, farger, passform", "Notiser & Kalender", "Paminnelser, kalendersynk", "Profil & Konto", "Premium, namn, e-post", "Data & Integritet", "Exportera, radera konto" |
| `src/pages/settings/SettingsAppearance.tsx` | PageHeader title "Utseende", "Auto" button label |
| `src/pages/settings/SettingsNotifications.tsx` | PageHeader title "Notiser & Kalender" |
| `src/pages/settings/SettingsAccount.tsx` | PageHeader title "Profil & Konto" |
| `src/pages/settings/SettingsStyle.tsx` | PageHeader title "Stil", SelectItem values "Loose", "Regular", "Slim", "Klassisk" |

**Calendar section (1 file):**

| File | Hardcoded strings |
|------|------------------|
| `src/components/settings/CalendarSection.tsx` | "Synkad", "Behover synkas", "Ej synkad", "Senast synkad...", "Automatisk var 6:e timme", "Synka nu", "Koppla Google Calendar", "ICS-lank", "Koppla Apple Calendar...", "Lagg till ICS-lank", "Klistra in din ICS-lank", "Synka kalender", "Hur hittar jag min ICS-lank?", all Google/Outlook/Apple help text, "Kalendersynk" section title |

**Premium/billing pages (4 files):**

| File | Hardcoded strings |
|------|------------------|
| `src/components/PremiumSection.tsx` | "Testlage", "Aktiv", "Betalning misslyckades...", "Obegransad garderob", "Obegransade outfits", "Hantera prenumeration", "Plagg", "Outfits denna manad", "79 kr/manad", "699 kr/ar (spara 26%)", "Jag har redan Premium", toast messages |
| `src/components/PaywallModal.tsx` | "Las upp Premium", limit messages, "Obegransad garderob", "Lagg till hur manga plagg...", "Obegransade outfits", "Smartare rekommendationer", "79 kr/manad", "699 kr/ar", "Inte nu", toast messages |
| `src/pages/Pricing.tsx` | All FAQ questions/answers, trust bullets, "Las upp din fulla garderob", "Manadsvis", "Arsvis", feature names, "Starta Premium", "Vanliga fragor", "Free-planen inkluderar" list |
| `src/pages/BillingSuccess.tsx` | "Premium aktiverat!", description, feature list, "Borja anvanda Premium", "Hantera prenumeration" |
| `src/pages/BillingCancel.tsx` | "Avbrutet", description, contact message, "Tillbaka till appen" |

**Share/public pages (1 file):**

| File | Hardcoded strings |
|------|------------------|
| `src/pages/ShareOutfit.tsx` | slotLabels map ("Overdel", "Underdel", etc.), "Delad outfit", "Kopierad!", "Kopiera lank", "Ladda ner", "Stil:", "Okant plagg", "Skapad med Wardrobe AI", CTA section text, toast messages |

**Marketing pages (3 files -- kept English-only as per existing pattern):**

| File | Note |
|------|------|
| `src/pages/marketing/Terms.tsx` | "Tillbaka" and "Senast uppdaterad:" are Swedish UI chrome on an English page -- replace with `t()` |
| `src/pages/marketing/PrivacyPolicy.tsx` | Same: "Tillbaka" and "Senast uppdaterad:" |
| `src/pages/marketing/Admin.tsx` | "Laddar..." |

**Onboarding (1 file):**

| File | Hardcoded strings |
|------|------------------|
| `src/components/onboarding/StylePreferencesStep.tsx` | "Klassisk" label, color names displayed as raw Swedish |

**Other:**

| File | Hardcoded strings |
|------|------------------|
| `src/pages/Outfits.tsx` | `date-fns` locale hardcoded to `sv` |
| `src/pages/GarmentDetail.tsx` | `toLocaleDateString('sv-SE')` |

---

### Translation keys to add (~120 new keys)

All keys will be added to `src/i18n/translations.ts` under a structured namespace:

- `settings.row.*` -- settings page row labels/sublabels
- `calendar.*` -- all calendar section strings
- `premium.*` -- premium/paywall/billing strings
- `pricing.*` -- pricing page strings
- `billing.*` -- billing success/cancel strings
- `share.*` -- share outfit page strings
- `common.back`, `common.loading` -- reusable strings

Each key gets translations for: `sv`, `en`, `no`, `da`, `fi`, `de`, `fr`, `es`, `it`, `pt`, `nl`, `pl`, `ar`, `fa`

---

### Technical approach

1. **Add all new translation keys** to `src/i18n/translations.ts` (bulk addition for all locales)
2. **Update each file** to import `useLanguage` (if not already) and replace hardcoded strings with `t('key')` calls
3. **Date formatting**: Replace hardcoded `locale: sv` and `'sv-SE'` with a locale-aware helper that maps the app locale to the correct `date-fns` locale
4. **Color names in filters/chips**: These are database values (stored as Swedish), so they stay as-is in filters but get display-mapped via `t()` where shown to users
5. **Marketing/Landing page**: Stays English (international audience). Only fix the "Tillbaka" / "Senast uppdaterad" UI chrome

### Implementation order

1. Add all translation keys to `translations.ts`
2. Update Settings hub + sub-pages (5 files)
3. Update CalendarSection
4. Update PremiumSection + PaywallModal
5. Update Pricing, BillingSuccess, BillingCancel
6. Update ShareOutfit
7. Update StylePreferencesStep
8. Fix date-fns locale mapping in Outfits + GarmentDetail
9. Fix marketing page chrome (Terms, Privacy, Admin)

