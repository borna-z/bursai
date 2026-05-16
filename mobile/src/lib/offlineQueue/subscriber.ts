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
    } catch {
      // A subscriber throwing must not corrupt queue state — swallow.
    }
  });
}
