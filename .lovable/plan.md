
# Beautiful Weather Widget for Today Page

## What Changes

Replace the current compact weather row on the Today page with a premium, visually rich weather widget that feels like a mini weather app embedded in DRAPE.

## Design

The widget will be a single card with two sections:

1. **Current weather hero** -- Large temperature display, weather icon, condition text, city name, and current time
2. **5-day mini forecast strip** -- Horizontal row showing the next 5 days with day name, weather icon, and high/low temps

The design will be clean and Scandinavian-minimal, matching the existing DRAPE aesthetic: rounded card, subtle borders, no gradients or heavy shadows.

## New Component

**`src/components/weather/WeatherWidget.tsx`**

A self-contained widget that:
- Uses `useWeather()` for current conditions (temperature, condition, location)
- Uses `useForecast()` for the 5-day forecast strip
- Shows a large weather icon (Sun, Cloud, CloudRain, etc.) mapped from weather code
- Displays current temp in large font (e.g. "-10deg")
- Shows condition text + city below
- Renders a horizontal 5-day forecast row at the bottom with day abbreviation, small icon, and high/low range
- Has a loading skeleton state
- Tapping the expand chevron still opens the manual weather edit (temperature/precipitation overrides)

## Changes to Home Page

**`src/pages/Home.tsx`**

- Import the new `WeatherWidget` component
- Replace the current `SettingsGroup` weather button (lines 111-186) with `<WeatherWidget />` that passes weather state and callbacks for manual override
- Keep the manual weather edit functionality (temperature input, precipitation badges) inside the widget as a collapsible section

## Technical Details

| File | Action |
|------|--------|
| `src/components/weather/WeatherWidget.tsx` | **Create** -- New weather widget component |
| `src/pages/Home.tsx` | **Edit** -- Replace weather card section with WeatherWidget |

### WeatherWidget Structure

```text
+------------------------------------------+
|  [Sun icon]     -10deg                    |
|                 Klart                     |
|  [pin] Stockholm         21:56           |
+------------------------------------------+
|  Thu   Fri   Sat   Sun   Mon             |
|  [ic]  [ic]  [ic]  [ic]  [ic]           |
|  -8    -5    -3    0     2               |
|  -12   -9    -7    -4    -2              |
+------------------------------------------+
```

- Large icon: 40x40px, mapped from weather code (same logic as WeatherForecastBadge)
- Temperature: text-4xl font-bold
- Condition: text-sm text-muted-foreground
- Location row: MapPin icon + city name, right-aligned current time
- Forecast strip: 5 columns, each with day abbreviation (Mon/Tue...), small icon, high temp (font-medium), low temp (text-muted-foreground)
- Card uses `bg-card rounded-2xl border` with generous padding
- Loading state uses Skeleton placeholders
- Responsive: fills full width on mobile, stays within max-w-lg on larger screens (handled by parent)

### Weather Icon Mapping

Reuse the same weather code to icon mapping from `WeatherForecastBadge.tsx`:
- Code 0: Sun
- Code 1-3: Cloud  
- Code 4-49: CloudFog
- Code 50-69: CloudRain
- Code 70-79: CloudSnow
- Code 80+: CloudLightning

### Forecast Day Labels

Use `date-fns` `format(date, 'EEE', { locale: sv })` for Swedish day abbreviations (Mån, Tis, Ons...).

### Manual Override

The expand/collapse for manual weather input stays as a small "Anpassa" link at the bottom of the card. When expanded, shows the temperature input and precipitation badges below the forecast strip.
