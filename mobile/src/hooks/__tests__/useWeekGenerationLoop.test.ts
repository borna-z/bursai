// useWeekGenerationLoop — asserts sequential edge-function calls.
//
// The per-user rate-limit budget makes a 7-shot parallel fan-out fatal,
// so the loop must remain strictly sequential. We mock callEdgeFunction
// and inspect the in-flight ordering: each subsequent call must only
// fire after the prior call's promise has resolved.

import { renderHook } from '@testing-library/react-native';

jest.mock('../../lib/edgeFunctionClient', () => ({
  __esModule: true,
  callEdgeFunction: jest.fn(),
  EdgeFunctionHttpError: class EdgeFunctionHttpError extends Error {},
  EdgeFunctionSubscriptionLockedError: class EdgeFunctionSubscriptionLockedError extends Error {},
  SUBSCRIPTION_SENTINEL: 'subscription_required',
}));

const client = require('../../lib/edgeFunctionClient') as {
  callEdgeFunction: jest.Mock;
};

beforeEach(() => {
  client.callEdgeFunction.mockReset();
});

describe('useWeekGenerationLoop', () => {
  it('fires per-day calls strictly sequentially', async () => {
    const { useWeekGenerationLoop } = require('../useWeekGenerationLoop');
    const { result } = renderHook(() => useWeekGenerationLoop());

    let inFlight = 0;
    let maxConcurrent = 0;
    const observedOrder: string[] = [];

    client.callEdgeFunction.mockImplementation(async (_fn: string, opts: { body: unknown }) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      observedOrder.push(((opts.body as { day_context?: { date?: string } }).day_context?.date) ?? '?');
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return {
        items: [
          { slot: 'top', garment_id: 'g-top' },
          { slot: 'bottom', garment_id: 'g-bottom' },
          { slot: 'shoes', garment_id: 'g-shoes' },
        ],
        explanation: 'ok',
      };
    });

    const dates = ['2026-05-16', '2026-05-17', '2026-05-18'];
    const ac = new AbortController();
    const weather = { temperature: 18, precipitation: 'none' as const, wind: 'none' as const };
    for (const date of dates) {
      const entry = await result.current.callOneDay({
        date, locale: 'en', recentlyWornIds: [], weather, signal: ac.signal,
      });
      expect(entry.error).toBeNull();
    }

    expect(maxConcurrent).toBe(1);
    expect(client.callEdgeFunction).toHaveBeenCalledTimes(dates.length);
  });
});
