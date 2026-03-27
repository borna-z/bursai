import { describe, expect, it } from 'vitest';
import { buildTodaySuggestions } from '../buildTodaySuggestions';

describe('buildTodaySuggestions', () => {
  it('anchors the sleeping-beauty suggestion to a specific garment', () => {
    const suggestions = buildTodaySuggestions(
      undefined,
      [],
      [],
      [{
        id: 'garment-1',
        title: 'Camel coat',
        category: 'outerwear',
        created_at: '2024-01-01T00:00:00.000Z',
        last_worn_at: null,
      } as never],
    );

    const anchorSuggestion = suggestions.find((suggestion) => suggestion.route === 'generate');
    expect(anchorSuggestion).toEqual(expect.objectContaining({
      garmentIds: ['garment-1'],
    }));
  });

  it('keeps weather and calendar prompts in chat mode', () => {
    const suggestions = buildTodaySuggestions(
      { temperature: 6, precipitation: 'rain' } as never,
      [{ id: 'event-1', title: 'Dinner', date: '2026-03-27', start_time: '19:00:00' } as never],
      [],
      [],
    );

    expect(suggestions[0]).toEqual(expect.objectContaining({
      route: 'chat',
      prefillMessage: suggestions[0].text,
    }));
    expect(suggestions[1]).toEqual(expect.objectContaining({
      route: 'chat',
      prefillMessage: suggestions[1].text,
    }));
  });
});
