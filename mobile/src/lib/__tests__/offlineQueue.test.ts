// offlineQueue smoke tests — N4.
//
// Exercises the persistence + replay surface against the in-memory
// AsyncStorage mock. The queue is module-scoped, so each test
// `jest.resetModules()` to start with a clean queue (avoids cross-test
// state leak from prior enqueues).

import { __resetAsyncStorageMock } from '../../__mocks__/async-storage';

beforeEach(() => {
  jest.resetModules();
  __resetAsyncStorageMock();
});

describe('offlineQueue', () => {
  it('enqueues an item and exposes it via snapshot/pendingCount', async () => {
     
    const mod = require('../offlineQueue') as typeof import('../offlineQueue');
    await mod.enqueue('demo-action', { foo: 'bar' });
    expect(mod.pendingCount()).toBe(1);
    const snap = mod.snapshot();
    expect(snap[0].action).toBe('demo-action');
    expect(snap[0].payload).toEqual({ foo: 'bar' });
  });

  it('replays queued items via the registered handler and dequeues on success', async () => {
     
    const mod = require('../offlineQueue') as typeof import('../offlineQueue');
    const handler = jest.fn().mockResolvedValue(undefined);
    mod.registerHandler('demo-action', handler);
    await mod.enqueue('demo-action', { id: 1 });
    await mod.enqueue('demo-action', { id: 2 });

    const result = await mod.replay();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ id: 1 });
    expect(handler).toHaveBeenCalledWith({ id: 2 });
    expect(result.succeeded).toBe(2);
    expect(result.remaining).toBe(0);
    expect(mod.pendingCount()).toBe(0);
  });

  it('drops items after MAX_ATTEMPTS handler failures (edge case)', async () => {
     
    const mod = require('../offlineQueue') as typeof import('../offlineQueue');
    const handler = jest.fn().mockRejectedValue(new Error('persistent failure'));
    mod.registerHandler('demo-action', handler);
    await mod.enqueue('demo-action', { id: 'x' });

    // First two replays leave the item parked with incremented attempts.
    await mod.replay();
    expect(mod.pendingCount()).toBe(1);
    await mod.replay();
    expect(mod.pendingCount()).toBe(1);
    // Third failure crosses MAX_ATTEMPTS=3 and drops it permanently.
    const r3 = await mod.replay();
    expect(r3.failed).toBe(1);
    expect(mod.pendingCount()).toBe(0);
  });
});
