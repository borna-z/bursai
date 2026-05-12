// FIFO queue with bounded concurrency. Used by LiveScan to keep storage
// uploads + analyze calls from saturating the network on rapid-fire bursts.
// Mirrors the spirit of `withConcurrencyLimit` in
// `supabase/functions/_shared/scale-guard.ts` but lives client-side.

export interface ScanQueueOptions {
  maxConcurrent: number;
}

export interface ScanQueue {
  enqueue<T>(job: () => Promise<T>): Promise<T>;
}

export function createScanQueue(opts: ScanQueueOptions): ScanQueue {
  let active = 0;
  const waiters: (() => void)[] = [];

  const acquire = (): Promise<void> => {
    if (active < opts.maxConcurrent) {
      active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waiters.push(resolve));
  };

  const release = (): void => {
    active -= 1;
    const next = waiters.shift();
    if (next) {
      active += 1;
      next();
    }
  };

  return {
    async enqueue<T>(job: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await job();
      } finally {
        release();
      }
    },
  };
}
