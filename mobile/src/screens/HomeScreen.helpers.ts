// Pure helpers extracted from HomeScreen.tsx (N13).
// No React hooks; safe to unit-test directly.

import { localISODate } from '../lib/outfitDisplay';
import { t as tr } from '../lib/i18n';

export type WeekDay = { dow: string; n: number; active: boolean; dot: boolean; iso: string };

// "Sat · Apr 26" — short weekday + dot separator + short month + day-of-month.
export function formatHeaderDate(d: Date): string {
  const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${dow} · ${mon} ${d.getDate()}`;
}

// Time-of-day greeting buckets: night (22:00–04:59) · morning (05:00–11:59) ·
// afternoon (12:00–16:59) · evening (17:00–21:59).
export function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5)  return tr('home.greeting.night');
  if (h < 12) return tr('home.greeting.morning');
  if (h < 17) return tr('home.greeting.afternoon');
  if (h < 22) return tr('home.greeting.evening');
  return tr('home.greeting.night');
}

// 7-day rolling window starting from `today`. Iteration uses
// `setDate(getDate() + i)` rather than fixed-ms arithmetic so a DST transition
// inside the window doesn't skip or duplicate a local calendar day.
// Codex P2 #5 on PR #699.
export function buildMiniWeek(today: Date, plannedDates: Set<string>): WeekDay[] {
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = localISODate(d);
    out.push({
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      n: d.getDate(),
      active: i === 0,
      dot: plannedDates.has(iso),
      iso,
    });
  }
  return out;
}
