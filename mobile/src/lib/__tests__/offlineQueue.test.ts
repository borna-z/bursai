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

  // Phase 1 audit coverage gap: persistence layer (the on-disk JSON shape)
  // had no round-trip test. A future change to `QueueItem` keys would
  // silently break replay of items persisted by older app installs.
  it('persists items in the byte-identical `QueueItem` JSON shape', async () => {

    const mod = require('../offlineQueue') as typeof import('../offlineQueue');
    await mod.enqueue('write-shape', { thing: 'value' });

    // Pull straight from AsyncStorage to verify the on-disk encoding.
    const storage = require('@react-native-async-storage/async-storage').default;
    const raw = (await storage.getItem('burs.offline-queue.v1')) as string | null;
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as Record<string, unknown>[];
    expect(parsed).toHaveLength(1);
    const item = parsed[0];
    // Exhaustive keys — any future addition should be conscious and
    // explicit; any deletion would lose data on read-back.
    expect(Object.keys(item).sort()).toEqual(
      ['action', 'attempts', 'createdAt', 'id', 'payload'].sort(),
    );
    expect(item.action).toBe('write-shape');
    expect(item.payload).toEqual({ thing: 'value' });
    expect(item.attempts).toBe(0);
    expect(typeof item.id).toBe('string');
    expect(typeof item.createdAt).toBe('number');
  });

  // Phase 1 audit coverage gap: HaltReplayError contract. The dispatcher
  // parks survivors WITHOUT incrementing `attempts` so retry-after
  // negotiation doesn't burn the user's MAX_ATTEMPTS budget on a
  // transient back-pressure halt.
  it('HaltReplayError parks survivors without incrementing attempts (single-action halt)', async () => {
    // Fake timers so the dispatcher's `scheduleDeferredReplay` (fired
    // because haltedActions.size > 0 after the halt) doesn't leak a real
    // 5 000 ms setTimeout into Jest's open-handle detector.
    jest.useFakeTimers();
    try {
      const mod = require('../offlineQueue') as typeof import('../offlineQueue');
      const { HaltReplayError } = mod;
      const handler = jest.fn().mockRejectedValue(new HaltReplayError(5000));
      mod.registerHandler('demo-action', handler);
      await mod.enqueue('demo-action', { id: 1 });
      await mod.enqueue('demo-action', { id: 2 });

      const r = await mod.replay();
      expect(r.succeeded).toBe(0);
      // The halt parks the SAME items the dispatcher saw in the snapshot;
      // both survivors retain attempts=0. A naive implementation would
      // double-count or drop after MAX_ATTEMPTS=3 halts — neither happens.
      expect(mod.pendingCount()).toBe(2);
      const snap = mod.snapshot();
      expect(snap.every((it) => it.attempts === 0)).toBe(true);
      // After the halt, only the FIRST item failed-then-halted; subsequent
      // items of the same action are parked verbatim without invoking the
      // handler again.
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  // Phase 1 audit coverage gap: single-flight replay semantics. Concurrent
  // `replay()` calls must coalesce — without this, a background-resume
  // can race with an explicit user-tap retry and double-process items.
  it('coalesces concurrent replay() calls into a single in-flight promise', async () => {

    const mod = require('../offlineQueue') as typeof import('../offlineQueue');
    const handler = jest.fn().mockResolvedValue(undefined);
    mod.registerHandler('demo-action', handler);
    await mod.enqueue('demo-action', { id: 1 });
    await mod.enqueue('demo-action', { id: 2 });

    // Two concurrent replays must coalesce. Without coalescing, each
    // would process the queue independently → handler called 4 times.
    // With coalescing, the second call returns the in-flight promise →
    // handler called 2 times (once per item).
    const [ra, rb] = await Promise.all([mod.replay(), mod.replay()]);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(ra).toBe(rb); // identical promise resolution — same in-flight
    expect(ra.succeeded).toBe(2);
    expect(mod.pendingCount()).toBe(0);
  });
});
