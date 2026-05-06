// React-facing surface for the offline queue + NetInfo state. Components that
// want to react to "we're offline" or "X mutations pending" subscribe here
// instead of importing offlineQueue directly.
//
// Single-source NetInfo subscription is owned by AuthContext (M5). This hook
// just *reads* the latest online flag and pending count via subscribe()
// callbacks — the queue + AuthContext together drive replay.

import { useEffect, useState, useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { pendingCount, subscribe } from '../lib/offlineQueue';

function getSnapshot(): number {
  return pendingCount();
}

export function useOfflineQueue(): {
  pending: number;
  isOnline: boolean;
} {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // NetInfo state — local subscription per consumer is fine, NetInfo dedupes
  // listeners internally. We default to "online" until proven otherwise so a
  // freshly-mounted screen doesn't flash an offline banner during the
  // initial fetch.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let mounted = true;
    NetInfo.fetch()
      .then((s: NetInfoState) => {
        if (!mounted) return;
        setIsOnline(deriveOnline(s));
      })
      .catch(() => {
        // NetInfo can throw on simulators with no network stack — treat
        // unknown as online so the banner doesn't lie.
      });
    const unsub = NetInfo.addEventListener((s) => {
      setIsOnline(deriveOnline(s));
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { pending, isOnline };
}

// Codex-defensive: NetInfo's `isConnected` can be null on older Android
// during the first tick. Treat null as online so a transient null doesn't
// pop the banner. `isInternetReachable` is the stronger signal but is also
// nullable — only treat false as offline.
function deriveOnline(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}
