
# Plan: Visa väderprognos för planerade outfits

## Översikt
Implementera väderprognos för planerade outfits så användare kan se förväntat väder för det datum de har planerat sin outfit. Open-Meteo API stödjer prognoser upp till 16 dagar framåt.

## Flöde

```text
┌─────────────────────────────────────────────────────────────┐
│              Planerade outfits med väder                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📅 Imorgon                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Outfit-kort]                      ☀️ 14°C Klart  │   │
│  │  Vardag · Avslappnad                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📅 Fredag 7 februari                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Outfit-kort]                      🌧️ 8°C Regn   │   │
│  │  Jobb · Professionell     ⚠️ Ta med regnkläder!   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📅 Måndag 10 februari                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Outfit-kort]              ❄️ -2°C Snö           │   │
│  │  Dejt · Romantisk          ⚠️ Kallt! Klä dig varmt │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📅 Tisdag 18 februari (>16 dagar)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Outfit-kort]              📊 Prognos ej tillgänglig │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Skapa useForecast hook

**Ny fil:** `src/hooks/useForecast.ts`

Hook för att hämta flerdagarsprognos från Open-Meteo:

```typescript
interface ForecastDay {
  date: string; // YYYY-MM-DD
  temperature_max: number;
  temperature_min: number;
  weather_code: number;
  condition: string;
  precipitation_probability: number;
}

interface UseForecastResult {
  forecast: ForecastDay[];
  isLoading: boolean;
  error: string | null;
  getForecastForDate: (date: string) => ForecastDay | null;
}
```

Funktionalitet:
- Hämtar 16-dagars prognos från Open-Meteo med parametern `daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max`
- Använder hemstad från profilen eller geolokalisering
- Cachar prognos i 1 timme (uppdateras sällan)
- Exponerar `getForecastForDate()` för att hämta väder för specifikt datum

### 2. Skapa WeatherForecastBadge komponent

**Ny fil:** `src/components/outfit/WeatherForecastBadge.tsx`

En kompakt vädervisning för outfit-kort:

```typescript
interface WeatherForecastBadgeProps {
  date: string; // YYYY-MM-DD
  compact?: boolean;
}
```

Visar:
- Väderikon (sol, moln, regn, snö)
- Temperatur (medel av max/min)
- Kort beskrivning ("Klart", "Regn", etc.)
- Varning vid extremt väder:
  - Om regn > 50%: "Ta med paraply!"
  - Om temp < 0: "Kallt! Klä dig varmt"
  - Om temp > 30: "Varmt! Tänk på solen"
- "Prognos ej tillgänglig" för datum > 16 dagar

### 3. Uppdatera PlannedOutfitsList

**Fil:** `src/pages/Outfits.tsx`

Integrera väderprognos i listan med planerade outfits:

- Importera `useForecast` och `WeatherForecastBadge`
- För varje datumgrupp, visa vädret för det datumet i headern
- I outfit-korten, visa kompakt väder-badge

Ändringar i `PlannedOutfitsList`:
```tsx
function PlannedOutfitsList({ outfits, onDelete }) {
  const { profile } = useProfile();
  const { forecast, getForecastForDate, isLoading: forecastLoading } = useForecast({
    homeCity: profile?.home_city
  });
  
  // ...i grupperingen:
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-primary" />
      <h3 className="font-semibold text-sm capitalize">{group.label}</h3>
    </div>
    <WeatherForecastBadge date={group.date} compact />
  </div>
}
```

### 4. Uppdatera OutfitCard för planerade outfits

**Fil:** `src/pages/Outfits.tsx` (OutfitCard)

Lägg till väder-info för planerade outfits:
- Visa temperatur och väderikon bredvid datumet
- Visa varning om vädret inte matchar outfitens sparade väder

### 5. Visa väderprognos i OutfitDetail vid planering

**Fil:** `src/pages/OutfitDetail.tsx`

I datumväljaren (Popover för planering):
- Visa väderprognos för valt datum
- Varning om vädret skiljer sig mycket från outfitens originalväder

Exempel:
```text
┌─────────────────────────────────────┐
│ 📅 Välj datum                       │
├─────────────────────────────────────┤
│        Februari 2025                │
│  M  T  O  T  F  L  S               │
│  ...                                │
│                                     │
│ ☀️ Lördag 8 feb: 12°C, Klart       │
│ ⚠️ Outfiten skapades för 5°C       │
│                                     │
│ [Planera för detta datum]           │
└─────────────────────────────────────┘
```

---

## Tekniska detaljer

### Open-Meteo API för daglig prognos

```typescript
const url = `https://api.open-meteo.com/v1/forecast?` + new URLSearchParams({
  latitude: lat.toString(),
  longitude: lon.toString(),
  daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
  timezone: 'auto',
  forecast_days: '16'
});
```

Response:
```json
{
  "daily": {
    "time": ["2025-02-03", "2025-02-04", ...],
    "temperature_2m_max": [8.2, 6.5, ...],
    "temperature_2m_min": [2.1, 0.8, ...],
    "weather_code": [3, 61, ...],
    "precipitation_probability_max": [10, 85, ...]
  }
}
```

### Cachning
- Prognos cachas i minne med React Query (staleTime: 60 min)
- Undviker överdrivna API-anrop

### Felhantering
- Om geocoding misslyckas → Stockholm som fallback
- Om API misslyckas → Visa "Väder ej tillgängligt"
- Om datum > 16 dagar → Visa "Prognos ej tillgänglig ännu"

---

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/hooks/useForecast.ts` | Ny hook för väderprognos |
| `src/components/outfit/WeatherForecastBadge.tsx` | Ny komponent för väderbadge |
| `src/pages/Outfits.tsx` | Integrera väder i PlannedOutfitsList |
| `src/pages/OutfitDetail.tsx` | Visa prognos vid datumval |
| `src/hooks/useWeather.ts` | Extrahera geocoding-funktioner för återanvändning |

### Ingen databasändring krävs
All data hämtas från externa API:er baserat på `planned_for`-datumet som redan finns i outfits-tabellen.

---

## Begränsningar
- Open-Meteo ger max 16 dagars prognos
- Prognos blir mindre pålitlig ju längre fram i tiden
- Kräver användarens hemstad eller geolokalisering
