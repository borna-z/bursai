import { describe, expect, it } from 'vitest';
import { buildDayIntelligence } from '@/lib/dayIntelligence';

describe('buildDayIntelligence', () => {
  it('identifies office-to-evening strategy for work plus dinner day', () => {
    const result = buildDayIntelligence([
      { title: 'Client meeting - Boardroom 3', location: 'City Office', start_time: '09:00', end_time: '10:00' },
      { title: 'Team sync', start_time: '13:00', end_time: '13:30' },
      { title: 'Dinner at Sora', start_time: '19:00', end_time: '21:00' },
    ], { temperature: 14, precipitation: 'none', wind: 'low' });

    expect(result.strategy).toBe('office_to_evening');
    expect(result.transition_complexity).not.toBe('low');
    expect(result.anchor_event?.title).toContain('Client meeting');
    expect(result.emphasis.versatility).toBeGreaterThan(5);
  });

  it('elevates travel practicality and weather-first strategy in rainy travel days', () => {
    const result = buildDayIntelligence([
      { title: 'Airport terminal check-in', start_time: '06:00', end_time: '07:30' },
      { title: 'Hotel check-in', start_time: '15:00', end_time: '16:00' },
      { title: 'Evening drinks', start_time: '20:00', end_time: '22:00' },
    ], { temperature: 7, precipitation: 'rain', wind: 'high' });

    expect(result.travel_relevance).toBe('high');
    expect(result.weather_sensitivity).toBe('high');
    expect(['weather_first', 'comfort_first']).toContain(result.strategy);
    expect(result.weather_constraints.join(' ')).toContain('rain');
    expect(result.emphasis.travel_practicality).toBeGreaterThan(6);
  });
});
