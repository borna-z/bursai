

## Translate Weather Conditions Based on Selected Language

Currently, weather condition text (e.g. "Klart", "Molnigt", "Regn") is hardcoded in Swedish in two files. These need to use the translation system so they change with the selected language.

### What will change

**1. `src/i18n/translations.ts`** -- Add weather condition keys for all languages:

New keys: `weather.condition.clear`, `weather.condition.cloudy`, `weather.condition.fog`, `weather.condition.drizzle`, `weather.condition.rain`, `weather.condition.snow`, `weather.condition.rain_showers`, `weather.condition.snow_showers`, `weather.condition.thunder`, `weather.condition.unknown`

| Key | Swedish | English | Norwegian |
|-----|---------|---------|-----------|
| `weather.condition.clear` | Klart | Clear | Klart |
| `weather.condition.cloudy` | Molnigt | Cloudy | Skyet |
| `weather.condition.fog` | Dimma | Fog | Tåke |
| `weather.condition.drizzle` | Duggregn | Drizzle | Yr |
| `weather.condition.rain` | Regn | Rain | Regn |
| `weather.condition.snow` | Sno | Snow | Sno |
| `weather.condition.rain_showers` | Regnskurar | Rain showers | Regnbyger |
| `weather.condition.snow_showers` | Snobyar | Snow showers | Snobyger |
| `weather.condition.thunder` | Aska | Thunder | Torden |
| `weather.condition.unknown` | Okant | Unknown | Ukjent |

(Plus all other supported languages.)

**2. `src/hooks/useWeather.ts`** -- Change `getConditionFromCode()` to return a translation key (e.g. `'weather.condition.clear'`) instead of a hardcoded Swedish string. The hook itself cannot call `t()` since it's not a component, so it will return the key, and the condition will be translated at render time.

**3. `src/hooks/useForecast.ts`** -- Same change: return translation keys instead of Swedish strings.

**4. `src/components/weather/WeatherWidget.tsx`** -- Two changes:
- Wrap `weather.condition` and `forecast.condition` through `t()` when rendering
- Replace hardcoded `{ locale: sv }` in date formatting with the locale-aware approach (use the current locale for day names)

**5. `src/components/outfit/WeatherForecastBadge.tsx`** -- Wrap `forecast.condition` through `t()` when rendering.

### How it works

The weather hooks will store a translation key like `weather.condition.rain` instead of `"Regn"`. Components that display the condition text will call `t(weather.condition)` to get the translated string. This way the weather text automatically follows the user's selected language.
