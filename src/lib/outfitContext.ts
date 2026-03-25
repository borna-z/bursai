/**
 * Normalized weather and outfit context contract.
 * Single source of truth for weather shape across client + server.
 */

export interface NormalizedWeather {
  temperature?: number;
  precipitation: string;
  wind: string;
  condition?: string;
}

export interface OutfitContext {
  occasion: string;
  style?: string | null;
  eventTitle?: string | null;
  weather: NormalizedWeather;
  locale: string;
  swap_mode?: 'safe' | 'bold' | 'fresh';
}

/**
 * Normalize any weather object (legacy `temp` or modern `temperature`)
 * into the canonical NormalizedWeather shape.
 */
export function normalizeWeather(
  raw?: Record<string, unknown> | null
): NormalizedWeather {
  if (!raw) {
    return { precipitation: 'none', wind: 'low' };
  }

  // Support both `temp` (legacy saved outfits) and `temperature` (modern)
  const temperature =
    typeof raw.temperature === 'number'
      ? raw.temperature
      : typeof raw.temp === 'number'
        ? raw.temp
        : undefined;

  const precipitation =
    typeof raw.precipitation === 'string' && raw.precipitation
      ? raw.precipitation
      : 'none';

  const wind =
    typeof raw.wind === 'string' && raw.wind
      ? raw.wind
      : 'low';

  const condition =
    typeof raw.condition === 'string' && raw.condition
      ? raw.condition
      : undefined;

  return { temperature, precipitation, wind, condition };
}

/**
 * Build a fully normalized OutfitContext from loose inputs.
 */
export function normalizeOutfitContext(raw: {
  occasion?: string;
  style?: string | null;
  eventTitle?: string | null;
  event_title?: string | null;
  weather?: Record<string, unknown> | null;
  locale?: string;
  swap_mode?: string;
}): OutfitContext {
  const swapMode =
    raw.swap_mode === 'bold' || raw.swap_mode === 'fresh'
      ? raw.swap_mode
      : raw.swap_mode === 'safe'
        ? 'safe'
        : undefined;

  return {
    occasion: raw.occasion || 'vardag',
    style: raw.style || null,
    eventTitle: raw.eventTitle || raw.event_title || null,
    weather: normalizeWeather(raw.weather),
    locale: raw.locale || 'en',
    ...(swapMode ? { swap_mode: swapMode } : {}),
  };
}
