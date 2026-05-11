// Pure helpers + constants extracted from TravelCapsuleScreen.tsx (N13).
// No React hooks; safe to unit-test directly.

// Curated suggestions for the destination chip strip. Labelled "Popular" rather
// than "Recent" so a first-time user doesn't see cities they've never visited
// being framed as their own travel history.
export const POPULAR_DESTINATIONS = ['Lisbon', 'Tokyo', 'New York', 'Copenhagen', 'Marrakesh'];

export const TRIP_TYPES = ['Business', 'Leisure', 'Beach', 'City', 'Outdoor', 'Winter'] as const;
export type TripType = (typeof TRIP_TYPES)[number];

// G3 sub-issue 3 — multi-select Occasions (web parity with TravelStep2).
// Trip type stays single-select; Occasions are an additional multi-select
// chip grid plumbed into the edge function's `occasions: string[]` input
// (verified at `supabase/functions/travel_capsule/index.ts:91,440,516`).
// Order + ids match `src/components/travel/types.ts` OCCASIONS so a user
// who plans on the web sees the same labels on mobile.
export const OCCASION_IDS = [
  'work',
  'dinner',
  'beach',
  'hiking',
  'nightlife',
  'wedding',
  'sightseeing',
  'airport',
  'active',
] as const;
export type OccasionId = (typeof OCCASION_IDS)[number];

// Map the visible TripType chips onto the trip_type strings the edge
// function recognises (`TRIP_TYPE_CONTEXT` dict in the function).
export const TRIP_TYPE_TO_BACKEND: Record<TripType, string> = {
  Business: 'business',
  Leisure: 'casual',
  Beach: 'beach',
  City: 'mixed',
  Outdoor: 'casual',
  Winter: 'winter',
};

// Strict YYYY-MM-DD parser. `Date.parse` interprets ISO date strings as UTC, but the user
// types local-calendar dates — and Hermes returns NaN inconsistently for non-ISO forms
// (e.g. "5/12/2026"). Parse via explicit components and treat both endpoints as the same
// timezone, returning the night-count.
//
// Returns null on missing or malformed input; returns 0 for same-day (day trip).
// Codex audit P1.1 + P1.2.
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

export function nightsBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (!a || !b || b.getTime() < a.getTime()) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function offsetISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return localISO(d);
}

export const DATE_PRESETS: readonly { label: string; daysFromToday: number }[] = [
  { label: 'Today',     daysFromToday: 0 },
  { label: 'Tomorrow',  daysFromToday: 1 },
  { label: '+3 days',   daysFromToday: 3 },
  { label: '+1 week',   daysFromToday: 7 },
  { label: '+2 weeks',  daysFromToday: 14 },
];

export function shortDateLabel(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatRowDates(start: string | null, end: string | null): string {
  if (!start) return '';
  const s = shortDateLabel(start);
  if (!end || end === start) return s;
  return `${s} – ${shortDateLabel(end)}`;
}

// ---------- Mini calendar (used by the "Custom" preset) ----------

export type DayCell = {
  date: Date;
  iso: string;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
};

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 6×7 Monday-first grid (42 cells), starting on the Monday on/before the 1st of the month.
// Mirrors MonthCalendarScreen's buildMonthGrid so the visual rhythm matches.
export function buildMonthGrid(year: number, month: number, today: Date): DayCell[] {
  const first = new Date(year, month, 1);
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDow);
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      iso: localISO(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: sameDay(d, today),
    });
  }
  return cells;
}

export function buildWeekdayHeaders(): string[] {
  const out: string[] = [];
  // 2024-01-01 was a Monday — anchor in UTC to dodge DST drift on the synthetic Date.
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    out.push(
      d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }).slice(0, 3).toUpperCase(),
    );
  }
  return out;
}

// Sub-step within Step 1 of the wizard. M28(b) split the original
// destination/dates form behind a "Pick must-haves" sub-step:
//   - 'picker' — user curates which wardrobe garments anchor the trip.
//     Selection threads through to `useGenerateTravelCapsule` as
//     `mustHaveItemIds`. Empty selection allowed (skip → AI-only).
//   - 'form'   — original destination + dates + trip-type + saved-trips
//     surface. Generation kicks off from this sub-step's CTA.
// The TravelMustHaves screen still represents "Step 2 of 3" — both
// sub-steps live under Step 1.
export type WizardSubStep = 'picker' | 'form';

export const PICKER_MAX = 8;
