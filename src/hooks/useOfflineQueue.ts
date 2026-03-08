import { useState, useEffect, useCallback } from 'react';
import { getQueueLength, replayQueue } from '@/lib/offlineQueue';
import { toast } from 'sonner';

/**
 * Hook that tracks online/offline status and the offline mutation queue.
 * Automatically replays queued mutations when coming back online.
 */
export function useOfflineQueue() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(getQueueLength);
  const [isReplaying, setIsReplaying] = useState(false);

  // Track online/offline
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      // Auto-replay when back online
      handleReplay();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Track queue count changes
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setQueueCount(detail?.count ?? getQueueLength());
    };
    window.addEventListener('offline-queue-change', handler);
    return () => window.removeEventListener('offline-queue-change', handler);
  }, []);

  const handleReplay = useCallback(async () => {
    const pending = getQueueLength();
    if (pending === 0) return;

    setIsReplaying(true);
    try {
      const synced = await replayQueue();
      if (synced > 0) {
        toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''}`);
      }
      setQueueCount(getQueueLength());
    } finally {
      setIsReplaying(false);
    }
  }, []);

  return { isOffline, queueCount, isReplaying };
}
