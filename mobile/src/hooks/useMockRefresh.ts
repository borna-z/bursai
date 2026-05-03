// useMockRefresh — small helper for the mock pull-to-refresh + initial-load path used by every
// data-driven screen during the design pass. Returns `{ refreshing, loading, onRefresh, retry,
// setError }` so a screen only needs one line to wire `RefreshControl` and the loading/error
// branches.
//
// Once a screen swaps mock data for a real React Query hook, replace `useMockRefresh()` with
// the hook's `{ isLoading, isRefetching, isError, refetch }` so the same pattern holds.
//
// Centralising this also fixes a subtle bug pattern that crept into the per-screen copies:
// returning a cleanup fn from inside `useCallback` is dead code (the caller doesn't run it).
// Here we own a single ref and clear it from the real `useEffect` unmount.

import { useCallback, useEffect, useRef, useState } from 'react';

export type MockRefreshState = {
  refreshing: boolean;
  loading: boolean;
  error: boolean;
  /** Pull-to-refresh handler — wires to `RefreshControl.onRefresh`. */
  onRefresh: () => void;
  /** Retry handler — wires to ErrorState's onRetry. */
  retry: () => void;
  /** Force the screen into the error branch (used by dev toggles). */
  setError: (next: boolean) => void;
};

export function useMockRefresh(loadDurationMs = 800): MockRefreshState {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial mount load timer + unmount cleanup. Both set/clear go through `timerRef` so a
  // refresh during initial-load doesn't leave an orphan timer firing setLoading on a stale
  // component.
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLoading(false);
    }, loadDurationMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadDurationMs]);

  const onRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setRefreshing(true);
    setError(false);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setRefreshing(false);
    }, loadDurationMs);
  }, [loadDurationMs]);

  const retry = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(false);
    setLoading(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setLoading(false);
    }, loadDurationMs);
  }, [loadDurationMs]);

  return { refreshing, loading, error, onRefresh, retry, setError };
}
