// Insights dashboard data for the mobile InsightsScreen — computed client-side
// from `garments` + `wear_logs` in a single round-trip.
//
// Why not the `insights_dashboard` edge function: its response is sized for the
// web dashboard (spending, sustainability, behavior heatmap, style DNA, etc.).
// The mobile screen only needs four cuts (stats, three gauges, palette, weekly
// bars, top-five most worn), and the edge response doesn't expose the gauge
// scores the screen wants in a usable shape (cost_per_wear_score etc. don't
// exist there). Computing locally produces the same values, with one query
// instead of two, and no rate-limit pressure on the (15/hr) edge endpoint.
//
// All reads are scoped by `user_id` and rely on RLS as defence in depth.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Garment } from '../types/garment';

export interface InsightsGauge {
  label: string;
  value: number;
  max: number;
  unit: string;
  delta: string;
  deltaDir: 'up' | 'down' | 'neutral';
}

export interface InsightsPaletteEntry {
  color: string;
  label: string;
  percent: number;
}

export interface InsightsMostWorn {
  garmentId: string;
  title: string;
  category: string | null;
  wearCount: number;
  imagePath: string | null;
}

export interface InsightsBarDay {
  label: string;
  value: number;
  max: number;
}

export interface InsightsData {
  totalGarments: number;
  totalWears: number;
  wardrobeUsagePct: number;
  gauges: InsightsGauge[];
  palette: InsightsPaletteEntry[];
  mostWorn: InsightsMostWorn[];
  weeklyBars: InsightsBarDay[];
  avgCostPerWear: number | null;
}

const WEEKLY_BAR_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useInsightsDashboard() {
  const { user } = useAuth();

  return useQuery<InsightsData, Error>({
    queryKey: ['insights_dashboard', user?.id],
    queryFn: () => computeFromRawData(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

type GarmentRow = Pick<
  Garment,
  | 'id'
  | 'title'
  | 'category'
  | 'color_primary'
  | 'wear_count'
  | 'last_worn_at'
  | 'rendered_image_path'
  | 'original_image_path'
  | 'purchase_price'
  | 'in_laundry'
>;

type WearLogRow = { worn_at: string | null };

async function computeFromRawData(userId: string): Promise<InsightsData> {
  const since30 = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();

  const [garmentsRes, wearLogsRes] = await Promise.all([
    supabase
      .from('garments')
      .select(
        'id, title, category, color_primary, wear_count, last_worn_at, rendered_image_path, original_image_path, purchase_price, in_laundry',
      )
      .eq('user_id', userId)
      .order('wear_count', { ascending: false, nullsFirst: false }),
    supabase
      .from('wear_logs')
      .select('worn_at')
      .eq('user_id', userId)
      .gte('worn_at', since30)
      .order('worn_at', { ascending: true }),
  ]);

  if (garmentsRes.error) throw garmentsRes.error;
  if (wearLogsRes.error) throw wearLogsRes.error;

  const garments = (garmentsRes.data ?? []) as GarmentRow[];
  const wearLogs = (wearLogsRes.data ?? []) as WearLogRow[];

  const totalGarments = garments.length;
  const wornGarments = garments.filter((g) => (g.wear_count ?? 0) > 0);
  const wardrobeUsagePct =
    totalGarments > 0 ? Math.round((wornGarments.length / totalGarments) * 100) : 0;
  const totalWears = wearLogs.length;

  // Most worn — top 5 with at least one wear. Garments are pre-sorted by
  // wear_count desc from the SQL query so a slice is enough.
  const mostWorn: InsightsMostWorn[] = wornGarments.slice(0, 5).map((g) => ({
    garmentId: g.id,
    title: g.title ?? 'Untitled',
    category: g.category,
    wearCount: g.wear_count ?? 0,
    imagePath: g.rendered_image_path ?? g.original_image_path ?? null,
  }));

  // Palette — bucket by color_primary, top 6 by share. Garments without a
  // recognised color name (free-form entries, future locales, missing values)
  // collapse into a single "Other" bucket so they never crowd the legend with
  // mis-mapped grey swatches. We compute share against the *known* total so
  // unmapped garments don't depress everyone else's percentages disproportionately.
  const colorMap: Record<string, number> = {};
  let knownColorCount = 0;
  for (const g of garments) {
    const raw = (g.color_primary ?? '').trim();
    const label = raw.length > 0 ? capitalize(raw) : '';
    if (label && COLOR_HEX_MAP[label]) {
      colorMap[label] = (colorMap[label] ?? 0) + 1;
      knownColorCount += 1;
    } else {
      colorMap.Other = (colorMap.Other ?? 0) + 1;
    }
  }
  const paletteDenominator = knownColorCount > 0 ? knownColorCount : totalGarments;
  const palette: InsightsPaletteEntry[] =
    totalGarments === 0
      ? []
      : Object.entries(colorMap)
          // Push "Other" to the end so a wardrobe with a lot of unmapped colors
          // doesn't wash out the real palette at the head of the bar.
          .sort((a, b) => {
            if (a[0] === 'Other') return 1;
            if (b[0] === 'Other') return -1;
            return b[1] - a[1];
          })
          .slice(0, 6)
          .map(([label, count]) => ({
            color: colorNameToHex(label),
            label,
            percent: Math.round((count / paletteDenominator) * 100),
          }))
          // Drop sub-1% slivers — they vanish visually and would just clutter
          // the legend with "0%" rows.
          .filter((entry) => entry.percent > 0);

  const weeklyBars = buildWeeklyBars(wearLogs);

  // Cost per wear — averaged across priced garments that have at least one wear.
  // Garments without a price or wear count are excluded; if nothing qualifies,
  // surface null so the screen can hide the metric rather than show "0.00".
  // PostgREST occasionally surfaces `numeric` columns as strings depending on
  // generated-type alignment, so we coerce defensively before filtering.
  const pricedPairs: { price: number; wears: number }[] = [];
  for (const g of garments) {
    const price = Number(g.purchase_price);
    const wears = g.wear_count ?? 0;
    if (Number.isFinite(price) && price > 0 && wears > 0) {
      pricedPairs.push({ price, wears });
    }
  }
  const avgCostPerWear =
    pricedPairs.length > 0
      ? pricedPairs.reduce((sum, p) => sum + p.price / p.wears, 0) / pricedPairs.length
      : null;

  // Gauge derivations — variety is "% of wardrobe touched in 30d", care is
  // "% of wardrobe NOT in laundry right now". Cost-efficiency reuses the
  // wardrobe usage rate as a proxy until a dedicated CPW gauge ships.
  const inLaundry = garments.filter((g) => g.in_laundry === true).length;
  const careScore =
    totalGarments > 0 ? Math.round(((totalGarments - inLaundry) / totalGarments) * 100) : 100;
  const gauges: InsightsGauge[] = [
    {
      label: 'Cost / wear efficiency',
      value: wardrobeUsagePct,
      max: 100,
      unit: '%',
      delta: `${wornGarments.length} of ${totalGarments} worn`,
      deltaDir: wardrobeUsagePct >= 50 ? 'up' : 'down',
    },
    {
      label: 'Outfit variety',
      value: Math.min(wornGarments.length, 100),
      max: 100,
      unit: '',
      delta: `${wornGarments.length} pieces in rotation`,
      deltaDir: wornGarments.length >= 10 ? 'up' : 'neutral',
    },
    {
      label: 'Care & laundry on time',
      value: careScore,
      max: 100,
      unit: '%',
      delta: inLaundry === 0 ? 'All clean' : `${inLaundry} in laundry`,
      deltaDir: careScore >= 80 ? 'up' : 'down',
    },
  ];

  return {
    totalGarments,
    totalWears,
    wardrobeUsagePct,
    gauges,
    palette,
    mostWorn,
    weeklyBars,
    avgCostPerWear,
  };
}

function buildWeeklyBars(wearLogs: WearLogRow[]): InsightsBarDay[] {
  const counts: number[] = new Array(WEEKLY_BAR_DAYS).fill(0);
  const labels: string[] = new Array(WEEKLY_BAR_DAYS).fill('');
  const today = startOfDay(new Date());

  for (let i = 0; i < WEEKLY_BAR_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (WEEKLY_BAR_DAYS - 1 - i));
    labels[i] = d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  for (const log of wearLogs) {
    if (!log.worn_at) continue;
    const wornDay = startOfDay(new Date(log.worn_at));
    const diffDays = Math.round((today.getTime() - wornDay.getTime()) / MS_PER_DAY);
    if (diffDays < 0 || diffDays >= WEEKLY_BAR_DAYS) continue;
    const idx = WEEKLY_BAR_DAYS - 1 - diffDays;
    counts[idx] += 1;
  }

  const max = Math.max(1, ...counts);
  return counts.map((value, i) => ({ label: labels[i], value, max }));
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Approximate hex stops for common color names — used by PaletteBar so the
// segmented bar reads as the user's actual wardrobe palette. Mirrors the
// COLOR_HSL table the web Insights hook uses; kept small here because mobile
// only needs the top swatches, not a full lexicon. Unmapped colors fall back
// to a neutral tone so the bar still renders.
const COLOR_HEX_MAP: Record<string, string> = {
  Black: '#1a1a1a',
  White: '#f5f5f5',
  Navy: '#1a2a4a',
  Cream: '#f5ebda',
  Beige: '#d9c9a6',
  Brown: '#7a5c3a',
  Grey: '#9a9a9a',
  Gray: '#9a9a9a',
  Blue: '#3a6ea8',
  Green: '#3a7a4a',
  Red: '#c0392b',
  Pink: '#e8a0b0',
  Yellow: '#f5c842',
  Orange: '#e8822a',
  Purple: '#7a4a9a',
  Rust: '#b85c2a',
  Camel: '#c8964a',
  Olive: '#6b7a3a',
  Khaki: '#c8b47a',
  Tan: '#c8a87a',
  Burgundy: '#5a2230',
  Charcoal: '#2a2622',
  Slate: '#7a8089',
  Sage: '#a8b89a',
  Mustard: '#c8a82a',
  Teal: '#2a7a8a',
  Lavender: '#b8a8d8',
  Mint: '#a8d8c0',
  Coral: '#e88870',
  Taupe: '#9a8a7a',
  Other: '#bfb6a8',
};

function colorNameToHex(name: string): string {
  return COLOR_HEX_MAP[name] ?? '#9a9a9a';
}
