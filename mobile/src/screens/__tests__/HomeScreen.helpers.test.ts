// HomeScreen.helpers — N13 split unit coverage.
//
// Sanity checks the pure helpers extracted from HomeScreen.

import {
  buildMiniWeek,
  formatHeaderDate,
  greetingFor,
} from '../HomeScreen.helpers';
import { t as tr } from '../../lib/i18n';

describe('HomeScreen.helpers', () => {
  describe('formatHeaderDate', () => {
    it('formats a known date as "<dow> · <mon> <n>"', () => {
      // 2026-04-26 is a Sunday in UTC. Use a fixed date — locale string
      // formatting is en-US so this is stable across CI hosts.
      const d = new Date(2026, 3, 26); // Apr 26, 2026 (month is 0-indexed)
      const out = formatHeaderDate(d);
      expect(out).toMatch(/^[A-Z][a-z]{2} · [A-Z][a-z]{2} 26$/);
      expect(out).toContain('Apr');
    });
  });

  describe('greetingFor', () => {
    it('returns the morning greeting between 05:00 and 11:59', () => {
      const d = new Date(2026, 0, 1, 8, 0, 0);
      expect(greetingFor(d)).toBe(tr('home.greeting.morning'));
    });

    it('returns the afternoon greeting between 12:00 and 16:59', () => {
      const d = new Date(2026, 0, 1, 14, 0, 0);
      expect(greetingFor(d)).toBe(tr('home.greeting.afternoon'));
    });

    it('returns the evening greeting between 17:00 and 21:59', () => {
      const d = new Date(2026, 0, 1, 19, 0, 0);
      expect(greetingFor(d)).toBe(tr('home.greeting.evening'));
    });

    it('returns the night greeting at 22:00 and again before 05:00', () => {
      const late = new Date(2026, 0, 1, 23, 30, 0);
      const early = new Date(2026, 0, 1, 3, 0, 0);
      expect(greetingFor(late)).toBe(tr('home.greeting.night'));
      expect(greetingFor(early)).toBe(tr('home.greeting.night'));
    });
  });

  describe('buildMiniWeek', () => {
    it('returns 7 entries starting from today (active on index 0 only)', () => {
      const today = new Date(2026, 4, 11); // May 11 2026
      const week = buildMiniWeek(today, new Set());
      expect(week).toHaveLength(7);
      expect(week[0].active).toBe(true);
      expect(week.slice(1).every((d) => d.active === false)).toBe(true);
    });

    it('flags `dot: true` on dates that appear in plannedDates', () => {
      const today = new Date(2026, 4, 11);
      const planned = new Set<string>([
        // Day index 0 + day index 3
        '2026-05-11',
        '2026-05-14',
      ]);
      const week = buildMiniWeek(today, planned);
      expect(week[0].dot).toBe(true);
      expect(week[1].dot).toBe(false);
      expect(week[3].dot).toBe(true);
      expect(week[6].dot).toBe(false);
    });

    it('advances day-of-month correctly across a month boundary', () => {
      const today = new Date(2026, 0, 30); // Jan 30
      const week = buildMiniWeek(today, new Set());
      // Jan 30, 31, Feb 1, 2, 3, 4, 5
      expect(week.map((d) => d.n)).toEqual([30, 31, 1, 2, 3, 4, 5]);
    });
  });
});
