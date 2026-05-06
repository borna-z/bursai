// Reactive "current Date" hook.
//
// React Navigation keeps tab screens mounted while hidden, so a `useMemo(() =>
// new Date(), [])` pattern freezes the date for the lifetime of the mount.
// On apps left open across midnight (or backgrounded before midnight and
// foregrounded after), the header eyebrow / week strip / "wornToday" comparison
// keep using yesterday until the screen unmounts. Codex P2 on PR #738.
//
// This hook refreshes `now` from two signals:
//  1. AppState 'active' transitions — the user just brought the app to the
//     foreground; whatever the local clock says is correct.
//  2. A self-rescheduling midnight timer — the app was foregrounded the entire
//     time but the date rolled over while the user was scrolling.
//
// Consumers that derive ISO dates / weekdays / "today" comparisons should
// replace `useMemo(() => new Date(), [])` with `useNow()`. Other consumers
// that just need a one-off timestamp can keep using `new Date()` inline.

import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Schedule a tick at the next local midnight. The effect re-runs each
    // time `now` advances, so the next midnight is auto-rescheduled — no
    // setInterval, no drift.
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    // +1s buffer so the new Date() lands on the new day, not the previous
    // millisecond if the timer fires marginally early.
    const ms = Math.max(0, next.getTime() - Date.now()) + 1000;
    const id = setTimeout(() => setNow(new Date()), ms);
    return () => clearTimeout(id);
  }, [now]);

  return now;
}
