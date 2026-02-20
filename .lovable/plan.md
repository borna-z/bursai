

# Lagg till alder i onboarding kroppssteg

Lagga till ett aldersfalt i samma steg som langd, vikt och kon. Aldern sparas som `birth_year` i `preferences` JSONB-faltet (inte som alder direkt, utan fodelsearet -- sa att det forblir korrekt over tid).

## Andringar

### 1. `src/components/onboarding/BodyMeasurementsStep.tsx`
- Lagg till ett nytt nummerfalt for alder (placerat mellan konval och langd)
- Anvander `Calendar`-ikon fran lucide-react
- Placeholder "25", min 13, max 120
- Valfritt falt -- man kan fortsatta utan att fylla i
- Utvidga `onComplete`-callbacken till att aven skicka `age: number | null`

### 2. `src/pages/Onboarding.tsx`
- Uppdatera `handleSaveBodyMeasurements` sa att `age` sparas som `preferences.age` i profilen
- Samma monster som for gender (laggs in i JSONB-faltet)

### 3. `src/i18n/translations.ts`
- Lagga till oversattningsnycklar for alla 14 sprak:
  - `onboarding.body.age` -- "Alder"
  - `onboarding.body.age_optional` -- "(valfritt)"
  - `onboarding.body.age_suffix` -- "ar"

## Tekniska detaljer

- Ingen databasmigrering kravs -- sparas i `profiles.preferences` JSONB
- Interfacet utvidgas: `{ height_cm, weight_kg, gender, age }`
- Nytt state: `const [age, setAge] = useState('')`
- Renderas som ett `Input type="number"` med suffix "ar", identiskt med langd/vikt-faltens styling

