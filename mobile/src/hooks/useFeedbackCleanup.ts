// useFeedbackCleanup — encapsulates `bestEffortRemoveSelfie` and the
// resized-temp file cleanup originally inlined inside usePhotoFeedback.
// Pure storage / filesystem operations; safe to call with stale paths
// (no-ops on missing files / already-deleted blobs).

import { useCallback, useMemo, useRef } from 'react';
import { File as FsFile } from 'expo-file-system';

import { Sentry } from '../lib/sentry';
import { supabase } from '../lib/supabase';

const BUCKET = 'garments';

export function bestEffortRemoveSelfie(path: string): void {
  void supabase.storage
    .from(BUCKET)
    .remove([path])
    .then(({ error: removeErr }) => {
      if (removeErr) {
        Sentry.addBreadcrumb({
          category: 'storage',
          level: 'info',
          message: 'usePhotoFeedback.cleanupFailed',
          data: { path, message: removeErr.message },
        });
      }
    })
    .catch(() => {
      /* swallow — cleanup is best-effort */
    });
}

export function bestEffortDeleteTemp(uri: string | null): void {
  if (!uri) return;
  try {
    const f = new FsFile(uri);
    if (f.exists) f.delete();
  } catch {
    /* swallow — cleanup is best-effort */
  }
}

export interface FeedbackCleanupAPI {
  trackSelfiePath: (path: string | null) => void;
  getTrackedSelfiePath: () => string | null;
  sweepSelfie: (path: string) => void;
  sweepTemp: (uri: string | null) => void;
  sweepTracked: () => void;
}

export function useFeedbackCleanup(): FeedbackCleanupAPI {
  const lastSelfiePathRef = useRef<string | null>(null);

  const trackSelfiePath = useCallback((path: string | null) => {
    lastSelfiePathRef.current = path;
  }, []);
  const getTrackedSelfiePath = useCallback(() => lastSelfiePathRef.current, []);
  const sweepSelfie = useCallback((path: string) => {
    bestEffortRemoveSelfie(path);
    if (lastSelfiePathRef.current === path) {
      lastSelfiePathRef.current = null;
    }
  }, []);
  const sweepTemp = useCallback((uri: string | null) => {
    bestEffortDeleteTemp(uri);
  }, []);
  const sweepTracked = useCallback(() => {
    const tracked = lastSelfiePathRef.current;
    if (tracked) {
      bestEffortRemoveSelfie(tracked);
      lastSelfiePathRef.current = null;
    }
  }, []);

  // Memoize the returned object so consumers can include `cleanup` in
  // useEffect / useCallback deps without churning identity every render.
  // The fresh-object-each-render shape silently broke the unmount-cleanup
  // useEffect in `usePhotoFeedback` (it fired on every render, aborting
  // in-flight uploads) and inflated `submitFeedback` identity churn.
  return useMemo(
    () => ({
      trackSelfiePath,
      getTrackedSelfiePath,
      sweepSelfie,
      sweepTemp,
      sweepTracked,
    }),
    [trackSelfiePath, getTrackedSelfiePath, sweepSelfie, sweepTemp, sweepTracked],
  );
}
