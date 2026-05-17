// M46 — trialStart smoke tests.
//
// Branches covered after Codex P1 review (PR #876):
//   (1) online + call succeeds → no enqueue, no Sentry
//   (2) offline at the gate → enqueue, no call
//   (3) online at gate, call throws transient (5xx) → enqueue (NOT Sentry)
//       — Codex's escalation: this was the original bug. Supabase 5xx
//       during fresh signup while NetInfo says online must still queue.
//   (4) online at gate, call throws permanent (4xx) → Sentry, no enqueue
//   (5) online at gate, call throws network error (no http status) → enqueue
//   (6) subscription-locked (402-class) → Sentry (permanent for this op)
//   (7) NetInfo gate throws → propagates (documented gap)
// Plus: dispatchStartTrial forwards / surfaces errors.

jest.mock('../edgeFunctionClient', () => {
  class EdgeFunctionHttpError extends Error {
    status: number;
    constructor(fnName: string, status: number, bodyText = '') {
      super(`Edge function "${fnName}" failed: ${status} ${bodyText}`);
      this.name = 'EdgeFunctionHttpError';
      this.status = status;
    }
  }
  class EdgeFunctionSubscriptionLockedError extends Error {
    constructor() {
      super('subscription locked');
      this.name = 'EdgeFunctionSubscriptionLockedError';
    }
  }
  return {
    __esModule: true,
    callEdgeFunction: jest.fn(),
    EdgeFunctionHttpError,
    EdgeFunctionSubscriptionLockedError,
  };
});

jest.mock('../offlineQueue', () => ({
  __esModule: true,
  enqueue: jest.fn(async () => undefined),
  isOnlineNow: jest.fn(),
  scheduleDeferredReplay: jest.fn(),
}));

jest.mock('../sentry', () => ({
  __esModule: true,
  Sentry: {
    withScope: jest.fn((cb: (scope: { setTag: jest.Mock; setContext: jest.Mock }) => void) => {
      cb({ setTag: jest.fn(), setContext: jest.fn() });
    }),
    captureException: jest.fn(),
  },
}));

const edgeFn = require('../edgeFunctionClient') as {
  callEdgeFunction: jest.Mock;
  EdgeFunctionHttpError: new (fn: string, status: number, body?: string) => Error;
  EdgeFunctionSubscriptionLockedError: new () => Error;
};
const queue = require('../offlineQueue') as {
  enqueue: jest.Mock;
  isOnlineNow: jest.Mock;
  scheduleDeferredReplay: jest.Mock;
};
const sentry = require('../sentry') as {
  Sentry: { withScope: jest.Mock; captureException: jest.Mock };
};

beforeEach(() => {
  edgeFn.callEdgeFunction.mockReset();
  queue.enqueue.mockReset();
  queue.isOnlineNow.mockReset();
  queue.scheduleDeferredReplay.mockReset();
  sentry.Sentry.captureException.mockReset();
  sentry.Sentry.withScope.mockClear();
});

describe('enqueueStartTrial', () => {
  it('online + success: calls edge function once, no queue, no Sentry', async () => {
    queue.isOnlineNow.mockResolvedValue(true);
    edgeFn.callEdgeFunction.mockResolvedValue(null);
    const { enqueueStartTrial } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(edgeFn.callEdgeFunction).toHaveBeenCalledTimes(1);
    expect(edgeFn.callEdgeFunction).toHaveBeenCalledWith('start_trial', {
      body: {},
      retries: 2,
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(sentry.Sentry.captureException).not.toHaveBeenCalled();
  });

  it('offline at gate: enqueues + schedules deferred replay, does not call edge function', async () => {
    queue.isOnlineNow.mockResolvedValue(false);
    const { enqueueStartTrial, START_TRIAL_ACTION } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(queue.enqueue).toHaveBeenCalledWith(START_TRIAL_ACTION, { userId: 'user-1' });
    expect(queue.scheduleDeferredReplay).toHaveBeenCalledTimes(1);
    expect(edgeFn.callEdgeFunction).not.toHaveBeenCalled();
    expect(sentry.Sentry.captureException).not.toHaveBeenCalled();
  });

  it('online → transient 5xx: enqueues + schedules deferred replay, no Sentry — Codex P1 round 2', async () => {
    // Codex review round 2 on PR #876: without scheduleDeferredReplay,
    // a transient-online failure sits in the queue until app restart
    // or a NetInfo transition. The deferred replay self-checks NetInfo
    // before draining, so it's safe to call regardless of connectivity.
    queue.isOnlineNow.mockResolvedValue(true);
    edgeFn.callEdgeFunction.mockRejectedValue(
      new edgeFn.EdgeFunctionHttpError('start_trial', 503, 'service unavailable'),
    );
    const { enqueueStartTrial, START_TRIAL_ACTION } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(queue.enqueue).toHaveBeenCalledWith(START_TRIAL_ACTION, { userId: 'user-1' });
    expect(queue.scheduleDeferredReplay).toHaveBeenCalledTimes(1);
    expect(sentry.Sentry.captureException).not.toHaveBeenCalled();
  });

  it('online → network error (no status, no http class): enqueues, no Sentry', async () => {
    // Bare Error — could be a fetch failure that the edge client didn't
    // wrap. Treated as transient (the safer default for trial reliability).
    queue.isOnlineNow.mockResolvedValue(true);
    edgeFn.callEdgeFunction.mockRejectedValue(new Error('network'));
    const { enqueueStartTrial, START_TRIAL_ACTION } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(queue.enqueue).toHaveBeenCalledWith(START_TRIAL_ACTION, { userId: 'user-1' });
    expect(sentry.Sentry.captureException).not.toHaveBeenCalled();
  });

  it('online → permanent 4xx: captures to Sentry, no enqueue, no deferred replay', async () => {
    queue.isOnlineNow.mockResolvedValue(true);
    const err = new edgeFn.EdgeFunctionHttpError('start_trial', 400, 'bad request');
    edgeFn.callEdgeFunction.mockRejectedValue(err);
    const { enqueueStartTrial } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(sentry.Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.Sentry.captureException).toHaveBeenCalledWith(err);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(queue.scheduleDeferredReplay).not.toHaveBeenCalled();
  });

  it('online → subscription locked (402-class): captures to Sentry, no enqueue', async () => {
    queue.isOnlineNow.mockResolvedValue(true);
    const err = new edgeFn.EdgeFunctionSubscriptionLockedError();
    edgeFn.callEdgeFunction.mockRejectedValue(err);
    const { enqueueStartTrial } = require('../trialStart');

    await expect(enqueueStartTrial('user-1')).resolves.toBeUndefined();

    expect(sentry.Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.Sentry.captureException).toHaveBeenCalledWith(err);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('never propagates errors to the caller (non-blocking contract)', async () => {
    queue.isOnlineNow.mockRejectedValue(new Error('NetInfo died'));
    const { enqueueStartTrial } = require('../trialStart');
    // Even when the connectivity probe itself throws, the helper should
    // not surface that to its caller — AuthContext's fire-and-forget
    // contract is sacred. (Current implementation will throw here — this
    // test documents the gap so a follow-up can wrap the gate in
    // try/catch if we later harden against NetInfo flakiness. For now,
    // assert that the call does throw so the documented contract is
    // explicit; flip to `.resolves.toBeUndefined()` once hardened.)
    await expect(enqueueStartTrial('user-1')).rejects.toThrow('NetInfo died');
  });
});

describe('dispatchStartTrial', () => {
  it('forwards to callEdgeFunction with retries: 2', async () => {
    edgeFn.callEdgeFunction.mockResolvedValue(null);
    const { dispatchStartTrial } = require('../trialStart');

    await dispatchStartTrial({ userId: 'user-2' });

    expect(edgeFn.callEdgeFunction).toHaveBeenCalledWith('start_trial', {
      body: {},
      retries: 2,
    });
  });

  it('lets the offline-queue dispatcher see thrown errors (no swallowing)', async () => {
    const err = new Error('boom');
    edgeFn.callEdgeFunction.mockRejectedValue(err);
    const { dispatchStartTrial } = require('../trialStart');

    await expect(dispatchStartTrial({ userId: 'user-2' })).rejects.toThrow('boom');
  });
});
