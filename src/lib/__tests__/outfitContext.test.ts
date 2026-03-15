import { describe, it, expect } from 'vitest';
import { normalizeWeather, normalizeOutfitContext } from '../outfitContext';

describe('normalizeWeather', () => {
  it('normalizes legacy `temp` to `temperature`', () => {
    const result = normalizeWeather({ temp: 18 });
    expect(result.temperature).toBe(18);
    expect(result).not.toHaveProperty('temp');
  });

  it('prefers `temperature` over `temp` when both present', () => {
    const result = normalizeWeather({ temperature: 22, temp: 18 });
    expect(result.temperature).toBe(22);
  });

  it('passes through modern `temperature` key', () => {
    const result = normalizeWeather({ temperature: 15, precipitation: 'rain', wind: 'high' });
    expect(result).toEqual({
      temperature: 15,
      precipitation: 'rain',
      wind: 'high',
      condition: undefined,
    });
  });

  it('falls back safely when weather is null', () => {
    const result = normalizeWeather(null);
    expect(result).toEqual({
      temperature: undefined,
      precipitation: 'none',
      wind: 'low',
      condition: undefined,
    });
  });

  it('falls back safely when weather is undefined', () => {
    const result = normalizeWeather(undefined);
    expect(result.precipitation).toBe('none');
    expect(result.wind).toBe('low');
  });

  it('falls back safely for empty object', () => {
    const result = normalizeWeather({});
    expect(result.temperature).toBeUndefined();
    expect(result.precipitation).toBe('none');
    expect(result.wind).toBe('low');
  });

  it('preserves condition when present', () => {
    const result = normalizeWeather({ temperature: 10, condition: 'cloudy' });
    expect(result.condition).toBe('cloudy');
  });
});

describe('normalizeOutfitContext', () => {
  it('swap and generate both receive same normalized shape', () => {
    const generateCtx = normalizeOutfitContext({
      occasion: 'work',
      weather: { temperature: 20, precipitation: 'none', wind: 'low' },
      locale: 'en',
    });

    const swapCtx = normalizeOutfitContext({
      occasion: 'work',
      weather: { temp: 20, precipitation: 'none', wind: 'low' },
      locale: 'en',
      swap_mode: 'safe',
    });

    // Same weather shape regardless of input key
    expect(generateCtx.weather).toEqual(swapCtx.weather);
    expect(generateCtx.weather.temperature).toBe(20);
    expect(swapCtx.swap_mode).toBe('safe');
    expect(generateCtx.swap_mode).toBeUndefined();
  });

  it('normalizes event_title to eventTitle', () => {
    const ctx = normalizeOutfitContext({ event_title: 'Meeting' });
    expect(ctx.eventTitle).toBe('Meeting');
  });

  it('defaults occasion to vardag', () => {
    const ctx = normalizeOutfitContext({});
    expect(ctx.occasion).toBe('vardag');
  });

  it('validates swap_mode values', () => {
    expect(normalizeOutfitContext({ swap_mode: 'bold' }).swap_mode).toBe('bold');
    expect(normalizeOutfitContext({ swap_mode: 'fresh' }).swap_mode).toBe('fresh');
    expect(normalizeOutfitContext({ swap_mode: 'safe' }).swap_mode).toBe('safe');
    expect(normalizeOutfitContext({ swap_mode: 'invalid' }).swap_mode).toBeUndefined();
  });
});
