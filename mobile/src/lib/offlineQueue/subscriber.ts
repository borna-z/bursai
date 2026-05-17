import { log } from '../log';

const subscribers = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function emitChange(): void {
  subscribers.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      log.error(err, { context: 'offlineQueue.subscriber.notify_failed' });
      // A subscriber throwing must not corrupt queue state — swallow.
    }
  });
}
