import { useState, useEffect, useCallback } from 'react';
import { getQueueLength, replayQueue } from '@/lib/offlineQueue';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook that tracks online/offline status and the offline mutation queue.
 * Automatically replays queued mutations when coming back online.
 */
export function useOfflineQueue() {
  const { t } = useLanguage();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  const refreshQueueCount = useCallback(() => {
    setQueueCount(getQueueLength());
  }, []);

  const handleReplay = useCallback(async () => {
    const pending = await getQueueLength();
    if (pending === 0) return;

    setIsReplaying(true);
    try {
      const synced = await replayQueue();
      if (synced > 0) {
        toast.success(t('offline.synced_changes').replace('{count}', String(synced)));
      }
      refreshQueueCount();
    } finally {
      setIsReplaying(false);
    }
  }, [refreshQueueCount, t]);

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
  }, [handleReplay]);

  // Track queue count changes
  useEffect(() => {
    refreshQueueCount();

    const handler = (event: Event) => {
      const count = (event as CustomEvent<{ count?: number }>).detail?.count;
      if (typeof count === 'number') {
        setQueueCount(count);
        return;
      }
      refreshQueueCount();
    };
    window.addEventListener('offline-queue-change', handler);
    return () => window.removeEventListener('offline-queue-change', handler);
  }, [refreshQueueCount]);

  return { isOffline, queueCount, isReplaying };
}
