

# Fix: Centraliserad platshantering utan fallbacks

## Problem

1. **Manuell plats sparas inte** -- den lagras bara i `useState` och forsvinner vid sidnavigering eller refresh
2. **Varje komponent har sin egen plats-state** -- WeatherPill, WeatherWidget, Plan-sidan och andra delar av appen kannerr inte varandras platsval
3. **Plan-sidan ignorerar manuell plats** -- den skickar bara `profile.home_city` till forecast-hooken
4. **Fallback-kedja skapar forvirring** -- nar manuell plats misslyckas faller den tillbaka till gamla platsen istallet for att ge ett felmeddelande

## Losning

Skapa en centraliserad plats-kontext (`LocationContext`) som:
- Sparar manuell plats till `profiles.home_city` i databasen
- Delar platsvalet over hela appen (alla sidor)
- Fragar anvandaren om platsbekreftelse nar appen oppnas
- Inga fallbacks -- manuell plats ar laast tills anvandaren andrar den

---

## Tekniska andringar

### 1. Ny fil: `src/contexts/LocationContext.tsx`

En React-kontext som centraliserar platshantering:

- **State**: `effectiveCity` (den stad som anvands overallt)
- **Kalla**: `profile.home_city` fran databasen, eller `null` for auto-detect (geolokaliseringg)
- **`setManualCity(city)`**: Sparar till `profiles.home_city` via `useUpdateProfile` + uppdaterar lokal state
- **`clearManualCity()`**: Rensar `home_city` i profilen, atergar till auto-detect
- **`locationSource`**: `'manual'` eller `'auto'` -- sa UI vet om det ar laast
- **Vid appstart**: Om `home_city` finns i profilen, anvand den direkt (ingen fallback). Om den saknas, anvand geolokaliseringg.

### 2. Uppdatera: `src/hooks/useWeather.ts`

- Ta bort intern `homeCity`-logik
- Ta emot `city` fran `LocationContext` via konsumenten (WeatherPill etc.)
- Om `city` ar satt: anvand den. Punkt. Ingen fallback till geolokalisering.
- Om `city` ar `null`: anvand geolokalisering som vanligt

### 3. Uppdatera: `src/hooks/useForecast.ts`

- Samma andring: ingen egen `homeCity`-upphamtning
- Forecast-hooken far `city` fran den som anropar den
- Inga fallback-kedjor -- om stad ar satt, anvand den

### 4. Uppdatera: `src/components/weather/WeatherPill.tsx`

- Ta bort lokal `manualCity` useState
- Anvand `useLocation()` fran `LocationContext`
- Nar anvandaren skriver en ny stad: anropa `setManualCity(city)` som sparar till databasen
- Nar anvandaren klickar X: anropa `clearManualCity()` som rensar `home_city` i profilen
- Auto-expand forblir

### 5. Uppdatera: `src/components/weather/WeatherWidget.tsx`

- Samma andring som WeatherPill -- anvand `useLocation()` istallet for lokal state

### 6. Uppdatera: `src/pages/Plan.tsx`

- Anvand `useLocation()` for att hamta `effectiveCity`
- Skicka den till `useForecast({ city: effectiveCity })`
- Nu delar Plan-sidan samma plats som Home-sidan

### 7. Uppdatera andra konsumenter

- `src/components/plan/QuickGenerateSheet.tsx` -- anvand `useLocation()`
- `src/components/outfit/PlannedOutfitsList.tsx` -- anvand `useLocation()`
- `src/hooks/useDaySummary.ts` -- anvand `useLocation()`
- `src/components/outfit/WeatherForecastBadge.tsx` -- anvand `useLocation()`

### 8. Uppdatera: `src/App.tsx`

- Wrappa appen med `<LocationProvider>`

---

## Platsbekraftelse vid appstart

Nar anvandaren oppnar appen och det inte finns nagon sparad `home_city`:
- Appen forsoker hamta geolokalisering
- Om lyckad: visa en liten bekraftelsetoast/banner: "Vi har hittat din plats: Stockholm. Stammer det?" med knappar "Ja" / "Andra"
- Om "Ja": spara staden till `profiles.home_city`
- Om "Andra": oppna platsredigering

Om `home_city` redan ar sparad:
- Anvand den direkt, fraga inte

## Sammanfattning

```text
Fore:   WeatherPill [useState] ----x----> useWeather
        WeatherWidget [useState] --x----> useWeather  
        Plan.tsx -------profile.home_city-> useForecast
        (tre separata, osparkade plats-stater)

Efter:  LocationContext [profile.home_city i DB]
            |
            +---> WeatherPill (laser + skriver)
            +---> WeatherWidget (laser + skriver)
            +---> Plan.tsx (laser)
            +---> QuickGenerateSheet (laser)
            +---> PlannedOutfitsList (laser)
            +---> useDaySummary (laser)
            (en enda kalla, persisterad)
```
