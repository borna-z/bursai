
# Plan: Spara hemstad i profilen för snabbare väderhämtning

## Översikt
Implementera funktionalitet för att spara användarens hemstad i profilen, vilket gör att väder kan hämtas direkt utan att behöva använda geolokalisering varje gång.

## Nuläge
- `profiles`-tabellen har redan en `home_city`-kolumn (default: 'Stockholm')
- Väder hämtas via Open-Meteo API med geolokalisering
- Om geolokalisering misslyckas används Stockholm som fallback
- Ingen UI för att ställa in hemstad finns

## Flöde efter implementation

```text
┌─────────────────────────────────────────────────────────┐
│                    Startar appen                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Har sparad hemstad? ─────────────────────────────┐  │
│  │                                                    │  │
│  │  JA → Hämta koordinater för staden               │  │
│  │       → Hämta väder direkt (snabbt!)             │  │
│  │                                                    │  │
│  │  NEJ → Försök geolokalisering                    │  │
│  │        → Om OK: Visa "Spara som hemstad?"        │  │
│  │        → Om nekad: Fallback Stockholm            │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Uppdatera useWeather-hooken

**Fil:** `src/hooks/useWeather.ts`

Ändringar:
- Lägg till `getCoordinatesFromCity()` funktion som använder OpenStreetMap Nominatim för geocoding (stad → koordinater)
- Acceptera `homeCity` som parameter
- Ny logik:
  1. Om `homeCity` finns → geocoda och hämta väder direkt
  2. Annars → använd geolokalisering som nu
- Exponera `detectedLocation` för att kunna visa förslag om att spara

```typescript
interface UseWeatherOptions {
  homeCity?: string | null;
}

interface UseWeatherResult {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  detectedLocation: string | null; // För "spara som hemstad"
}
```

### 2. Lägg till hemstads-inställning i Settings

**Fil:** `src/pages/Settings.tsx`

Ändringar:
- Ny sektion "Plats" med MapPin-ikon
- Input-fält för hemstad med "Spara"-knapp
- Visa nuvarande sparad stad
- Populära svenska städer som snabbval (chips)

```text
┌─────────────────────────────────────────┐
│ 📍 Plats                                │
├─────────────────────────────────────────┤
│ Hemstad                                 │
│ ┌──────────────────────┐ ┌───────┐     │
│ │ Göteborg             │ │ Spara │     │
│ └──────────────────────┘ └───────┘     │
│                                         │
│ Vanliga städer:                         │
│ ┌──────────┐ ┌───────────┐ ┌───────┐   │
│ │Stockholm │ │ Göteborg  │ │ Malmö │   │
│ └──────────┘ └───────────┘ └───────┘   │
└─────────────────────────────────────────┘
```

### 3. Uppdatera Home.tsx att använda hemstad

**Fil:** `src/pages/Home.tsx`

Ändringar:
- Hämta profil med `useProfile()`
- Skicka `homeCity` till `useWeather({ homeCity: profile?.home_city })`
- Visa "Spara som hemstad"-knapp om:
  - Ingen hemstad är sparad
  - Geolokalisering lyckades hitta en plats
- Knappen sparar platsen via `updateProfile()`

```text
┌─────────────────────────────────────────┐
│ Väder                                   │
├─────────────────────────────────────────┤
│ 📍 Göteborg    12°C · Molnigt    🔄     │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 💾 Spara som hemstad               │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Tekniska detaljer

### Geocoding API (OpenStreetMap Nominatim)
```typescript
async function getCoordinatesFromCity(city: string): Promise<{lat: number, lon: number} | null> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&countrycodes=se`
  );
  const data = await response.json();
  if (data[0]) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
}
```

### Fördelar med denna lösning
- **Snabbare:** Ingen geolokaliserings-popup varje gång
- **Bättre UX:** Användaren kan välja sin stad manuellt
- **Fallback:** Om hemstad inte kan geocodas, används geolokalisering
- **Gratis API:** Nominatim kräver ingen API-nyckel

### Filer som ändras
1. `src/hooks/useWeather.ts` - Lägg till geocoding och hemstadsstöd
2. `src/pages/Settings.tsx` - Lägg till hemstads-sektion
3. `src/pages/Home.tsx` - Integrera med profil och visa "spara"-alternativ

### Ingen databasändring krävs
`home_city`-kolumnen finns redan i `profiles`-tabellen med default 'Stockholm'.
