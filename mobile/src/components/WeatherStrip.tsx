// WeatherStrip — current-conditions card on HomeScreen (M35).
//
// Layout: condition icon · big temp · short condition label · "Tomorrow {x}°"
// hint. Self-hides while the first fetch is in flight or on error so the page
// doesn't reserve dead space — the calling screen leaves a slot in its layout
// gap that disappears cleanly. Mirrors the spirit of `SmartDayBanner`'s
// hidden-states pattern.
//
// Icons are rendered inline as a tiny `<WeatherGlyph>` switch on Open-Meteo
// weather codes — keeping them here rather than promoting to `icons.tsx`
// avoids growing the shared icon set with single-use glyphs (the wave file
// only authorises new files in this directory and a HomeScreen edit).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTokens } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { Eyebrow } from './Eyebrow';
import { useWeather } from '../hooks/useWeather';
import { useForecast } from '../hooks/useForecast';
import { t } from '../lib/i18n';

export interface WeatherStripProps {
  /** Optional city override forwarded to the underlying hooks. */
  city?: string | null;
}

function WeatherGlyph({ code, size = 24, color }: { code: number; size?: number; color: string }) {
  const stroke = color;
  const sw = 1.6;
  // Sun (clear)
  if (code === 0) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={4} stroke={stroke} strokeWidth={sw} />
        <Path
          d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // Cloud (partly/cloudy)
  if (code <= 3) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 18h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 11.5 3.5 3.5 0 0 0 7 18Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  // Fog
  if (code === 45 || code === 48) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 9h16M3 13h18M5 17h14"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // Drizzle / rain
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 14h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 7.5 3.5 3.5 0 0 0 7 14Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <Path
          d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // Snow
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 13h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 6.5 3.5 3.5 0 0 0 7 13Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <Path
          d="M12 17v4M10 19h4M9 18.2l6 1.6M15 18.2l-6 1.6"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // Thunder
  if (code >= 95 && code <= 99) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 13h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 6.5 3.5 3.5 0 0 0 7 13Z"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
        <Path
          d="m12 14-2 4h3l-2 4"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  // Fallback — generic cloud
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 18h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 11.5 3.5 3.5 0 0 0 7 18Z"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WeatherStrip({ city }: WeatherStripProps) {
  const tokens = useTokens();
  const { weather, isLoading, error } = useWeather({ city });
  const { forecast } = useForecast({ city });

  // Self-hide while loading or on error so the layout doesn't reserve a dead
  // slot — same posture as SmartDayBanner. The strip is decorative, not
  // load-bearing.
  if (isLoading || error || !weather) return null;

  // forecast[0] is "today" per Open-Meteo's daily series — tomorrow lives at
  // index 1. Guard against a short response (e.g. when the daily endpoint
  // partially fails) by treating absence as "no hint".
  const tomorrow = forecast[1] ?? null;

  return (
    <View
      style={[
        styles.container,
        { borderColor: tokens.border, backgroundColor: tokens.card },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${weather.temperature}°, ${t(weather.condition)}`}>
      <View style={styles.iconWrap}>
        <WeatherGlyph code={weather.weather_code} color={tokens.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Eyebrow>{t('home.weather.eyebrow')}</Eyebrow>
        <View style={styles.row}>
          <Text style={[styles.temp, { color: tokens.fg, fontFamily: fonts.displayMedium }]}>
            {weather.temperature}°
          </Text>
          <Text style={[styles.cond, { color: tokens.fg2, fontFamily: fonts.ui }]} numberOfLines={1}>
            {t(weather.condition)}
          </Text>
        </View>
        {tomorrow ? (
          <Text style={[styles.hint, { color: tokens.fg3, fontFamily: fonts.ui }]} numberOfLines={1}>
            {t('home.weather.tomorrowTemplate', {
              high: tomorrow.temperature_max,
              low: tomorrow.temperature_min,
              condition: t(tomorrow.condition),
            })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  temp: {
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  cond: {
    fontSize: 13,
    flexShrink: 1,
  },
  hint: {
    fontSize: 11.5,
    marginTop: 2,
  },
});
