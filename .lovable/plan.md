

# Lagg till konval (Male / Female / Non-binary) i Onboarding

Lagga till en konval i steget dar man fyller i langd och vikt, sa att AI-stylisten kan ge annu battre passformsrad.

## Andringar

### 1. `src/components/onboarding/BodyMeasurementsStep.tsx`
- Lagga till ett nytt falt ovanfor langd-inputen med tre valknappar: **Man**, **Kvinna**, **Icke-binar**
- Anvander tre stilrena knappar i rad (liknande occasion-knapparna pa Home-sidan) med en `User`-ikon
- Valet ar valfritt -- man kan fortsatta utan att valja
- Uppdatera `onComplete`-callbacken sa att den aven skickar `gender: string | null`

### 2. `src/pages/Onboarding.tsx`
- Uppdatera `handleSaveBodyMeasurements` sa att `gender` sparas i `profiles.preferences.gender`
- Anvander samma monster som redan anvands for stil-preferenser (JSON i preferences-kolumnen)

### 3. `src/i18n/translations.ts`
- Lagga till oversattningsnycklar for alla 14 sprak:
  - `onboarding.body.gender` -- "Kon"
  - `onboarding.body.gender_optional` -- "(valfritt)"
  - `onboarding.body.male` -- "Man"
  - `onboarding.body.female` -- "Kvinna"
  - `onboarding.body.nonbinary` -- "Icke-binar"

## Tekniska detaljer

- Ingen databasmigrering kravs -- gender sparas i det befintliga `preferences` JSONB-faltet pa profiles-tabellen
- Interfacet `BodyMeasurementsStepProps.onComplete` utvidgas till `{ height_cm, weight_kg, gender }`
- De tre knapparna renderas som vanliga `button`-element med `cn()` for villkorlig styling (accent-farg vid valt)
- Ikonen `User` fran lucide-react anvands som label-ikon

