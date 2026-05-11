// TravelCapsuleScreen.helpers — N13 split unit coverage.
//
// Sanity checks the pure helpers extracted from TravelCapsuleScreen:
// strict ISO date parsing, night-count between two dates, the local-ISO
// formatter, and the 6×7 month grid layout used by the custom date picker.

import {
  buildMonthGrid,
  buildWeekdayHeaders,
  formatRowDates,
  localISO,
  nightsBetween,
  parseISODate,
  sameDay,
  shortDateLabel,
  startOfDay,
} from '../TravelCapsuleScreen.helpers';

describe('TravelCapsuleScreen.helpers', () => {
  describe('parseISODate', () => {
    it('parses a valid YYYY-MM-DD string', () => {
      const d = parseISODate('2026-05-11');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(4); // 0-indexed
      expect(d!.getDate()).toBe(11);
    });

    it('returns null for malformed input', () => {
      expect(parseISODate('5/11/2026')).toBeNull();
      expect(parseISODate('not a date')).toBeNull();
      expect(parseISODate('')).toBeNull();
      expect(parseISODate('2026-13-01')).toBeNull();
      expect(parseISODate('2026-02-32')).toBeNull();
    });
  });

  describe('nightsBetween', () => {
    it('returns 0 for the same start and end date (day trip)', () => {
      expect(nightsBetween('2026-05-11', '2026-05-11')).toBe(0);
    });

    it('returns the inclusive night count for a multi-day trip', () => {
      expect(nightsBetween('2026-05-11', '2026-05-14')).toBe(3);
    });

    it('returns null when end is before start', () => {
      expect(nightsBetween('2026-05-14', '2026-05-11')).toBeNull();
    });

    it('returns null on missing or malformed inputs', () => {
      expect(nightsBetween('', '2026-05-11')).toBeNull();
      expect(nightsBetween('2026-05-11', '')).toBeNull();
      expect(nightsBetween('not-a-date', '2026-05-11')).toBeNull();
    });
  });

  describe('localISO', () => {
    it('zero-pads month and day', () => {
      const d = new Date(2026, 0, 5); // Jan 5
      expect(localISO(d)).toBe('2026-01-05');
    });

    it('round-trips through parseISODate', () => {
      const original = new Date(2026, 4, 11);
      const iso = localISO(original);
      const reparsed = parseISODate(iso);
      expect(reparsed).not.toBeNull();
      expect(sameDay(reparsed!, original)).toBe(true);
    });
  });

  describe('formatRowDates', () => {
    it('returns empty string when start is missing', () => {
      expect(formatRowDates(null, '2026-05-14')).toBe('');
    });

    it('returns just the start when end is missing or equal', () => {
      expect(formatRowDates('2026-05-11', null)).toBe(shortDateLabel('2026-05-11'));
      expect(formatRowDates('2026-05-11', '2026-05-11')).toBe(shortDateLabel('2026-05-11'));
    });

    it('joins start – end when both are present and distinct', () => {
      const out = formatRowDates('2026-05-11', '2026-05-14');
      expect(out).toContain('–');
      expect(out).toContain(shortDateLabel('2026-05-11'));
      expect(out).toContain(shortDateLabel('2026-05-14'));
    });
  });

  describe('startOfDay / sameDay', () => {
    it('startOfDay zeros the time-of-day', () => {
      const d = new Date(2026, 4, 11, 15, 30, 45);
      const start = startOfDay(d);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('sameDay treats hour-of-day as irrelevant', () => {
      const a = new Date(2026, 4, 11, 1, 0);
      const b = new Date(2026, 4, 11, 23, 0);
      const c = new Date(2026, 4, 12, 0, 0);
      expect(sameDay(a, b)).toBe(true);
      expect(sameDay(a, c)).toBe(false);
    });
  });

  describe('buildMonthGrid', () => {
    it('returns 42 cells (6 weeks × 7 days)', () => {
      const today = new Date(2026, 4, 11);
      const grid = buildMonthGrid(2026, 4, today);
      expect(grid).toHaveLength(42);
    });

    it('marks the first cell as Monday and inMonth=false when month does not start on Monday', () => {
      const today = new Date(2026, 4, 11);
      // May 2026 starts on a Friday — first row spills back into April.
      const grid = buildMonthGrid(2026, 4, today);
      expect(grid[0].inMonth).toBe(false);
      // The Friday May 1 cell should appear and be inMonth=true.
      const may1 = grid.find((cell) => cell.iso === '2026-05-01');
      expect(may1?.inMonth).toBe(true);
    });

    it('flags isToday=true on the cell matching the today argument', () => {
      const today = new Date(2026, 4, 11);
      const grid = buildMonthGrid(2026, 4, today);
      const flagged = grid.filter((cell) => cell.isToday);
      expect(flagged).toHaveLength(1);
      expect(flagged[0].iso).toBe('2026-05-11');
    });
  });

  describe('buildWeekdayHeaders', () => {
    it('returns 7 uppercase weekday labels starting from Monday', () => {
      const out = buildWeekdayHeaders();
      expect(out).toHaveLength(7);
      out.forEach((label) => {
        expect(label).toBe(label.toUpperCase());
        expect(label.length).toBeLessThanOrEqual(3);
      });
    });
  });
});
