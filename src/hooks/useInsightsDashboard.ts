import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

export type Garment = Tables<'garments'>;

type WearLogRow = Pick<Tables<'wear_logs'>, 'garment_id' | 'occasion' | 'outfit_id' | 'worn_at'>;
type OutfitRow = Pick<Tables<'outfits'>, 'generated_at' | 'id' | 'occasion' | 'saved' | 'worn_at'>;
type PlannedOutfitRow = Pick<Tables<'planned_outfits'>, 'date' | 'status'>;

const METRIC_VERSION = '2026-03-28.v1';
const MS_PER_DAY = 86_400_000;

const COLOR_HSL: Record<string, [number, number, number]> = {
  beige: [40, 30, 80],
  black: [0, 0, 5],
  blue: [220, 70, 50],
  brown: [25, 50, 30],
  burgundy: [345, 60, 30],
  camel: [30, 45, 55],
  coral: [15, 70, 60],
  cream: [40, 25, 93],
  gray: [0, 0, 50],
  green: [130, 60, 40],
  grey: [0, 0, 50],
  khaki: [55, 30, 55],
  lavender: [270, 40, 70],
  lila: [270, 60, 50],
  marinbla: [220, 60, 20],
  mint: [160, 50, 70],
  mintgron: [160, 50, 70],
  mustard: [45, 70, 45],
  navy: [220, 60, 20],
  olive: [80, 40, 35],
  olivgron: [80, 40, 35],
  orange: [25, 85, 55],
  pink: [330, 60, 70],
  purple: [270, 60, 50],
  red: [0, 80, 45],
  rosa: [330, 60, 70],
  sage: [140, 20, 55],
  salvia: [140, 20, 55],
  svart: [0, 0, 5],
  terracotta: [15, 55, 45],
  terrakotta: [15, 55, 45],
  taupe: [30, 15, 55],
  vinrod: [345, 60, 30],
  vit: [0, 0, 97],
  white: [0, 0, 97],
  yellow: [50, 80, 55],
  bla: [220, 70, 50],
  brun: [25, 50, 30],
  gra: [0, 0, 50],
  gron: [130, 60, 40],
  gul: [50, 80, 55],
  kramvit: [40, 25, 93],
  lavendel: [270, 40, 70],
  rod: [0, 80, 45],
};

const NEUTRAL_COLORS = ['black', 'white', 'grey', 'gray', 'beige', 'navy', 'svart', 'vit', 'gra', 'marinbla'];

export interface ColorTemperatureData {
  temperature: number;
  warmCount: number;
  coolCount: number;
  neutralCount: number;
  totalChromatic: number;
  dominantPalette: 'warm' | 'cool' | 'neutral' | 'balanced';
}

export interface StyleDNAPattern {
  label: string;
  strength: number;
  detail: string;
}

export interface StyleDNA {
  signatureColors: { color: string; percentage: number }[];
  formalityCenter: number;
  formalitySpread: 'narrow' | 'moderate' | 'wide';
  uniformCombos: { combo: string[]; count: number }[];
  patterns: StyleDNAPattern[];
  archetype: string;
  outfitsAnalyzed: number;
}

export interface InsightsData {
  totalGarments: number;
  garmentsUsedLast30Days: number;
  usageRate: number;
  topFiveWorn: (Garment & { wearCountLast30: number })[];
  usedGarments: (Garment & { wearCountLast30: number })[];
  unusedGarments: Garment[];
  colorTemperature: ColorTemperatureData;
}

export interface DashboardCategoryBalanceItem {
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardRepeatOutfit {
  id: string;
  occasion: string;
  wornCount: number;
  lastWorn: string;
  daysSince: number;
}

export interface DashboardStaleOutfit {
  id: string;
  occasion: string;
  daysSince: number;
}

export interface DashboardHeatmapDay {
  date: string;
  status: 'planned' | 'improvised' | 'none';
}

export interface DashboardSpendingGarment {
  id: string;
  title: string | null;
  image_path: string | null;
  cpw: number;
  wears: number;
  price: number;
}

export interface DashboardSpendingData {
  totalValue: number;
  currency: string;
  categoryBreakdown: { category: string; total: number; count: number }[];
  topCostPerWear: DashboardSpendingGarment[];
  worstCostPerWear: DashboardSpendingGarment[];
}

export interface DashboardSustainabilityData {
  score: number;
  utilizationRate: number;
  avgWearCount: number;
  underusedCount: number;
  totalGarments: number;
}

export interface InsightsDashboardOverview {
  totalGarments: number;
  garmentsUsedLast30Days: number;
  unusedGarmentsLast30Days: number;
  usageRate: number;
  savedLooks: number;
  plannedThisWeek: number;
}

export interface InsightsDashboardWardrobeHealth {
  categoryBalance: DashboardCategoryBalanceItem[];
  colorTemperature: ColorTemperatureData;
  forgottenGems: Garment[];
  topFiveWorn: (Garment & { wearCountLast30: number })[];
  unusedGarments: Garment[];
  usedGarments: (Garment & { wearCountLast30: number })[];
}

export interface InsightsDashboardBehavior {
  consistency: number;
  heatmapDays: DashboardHeatmapDay[];
  repeats: DashboardRepeatOutfit[];
  staleOutfits: DashboardStaleOutfit[];
  streak: number;
}

export interface InsightsDashboardValue {
  spending: DashboardSpendingData | null;
  sustainability: DashboardSustainabilityData | null;
}

export interface InsightsDashboardData {
  behavior: InsightsDashboardBehavior;
  generatedAt: string;
  metricVersion: string;
  overview: InsightsDashboardOverview;
  styleDna: StyleDNA | null;
  value: InsightsDashboardValue;
  wardrobeHealth: InsightsDashboardWardrobeHealth;
}

interface RawInsightsDashboardData {
  behavior?: Record<string, unknown>;
  generated_at?: string;
  metric_version?: string;
  overview?: Record<string, unknown>;
  style_dna?: Record<string, unknown> | StyleDNA | null;
  styleDna?: Record<string, unknown> | StyleDNA | null;
  value?: Record<string, unknown> | InsightsDashboardValue;
  wardrobe_health?: Record<string, unknown> | InsightsDashboardWardrobeHealth;
  wardrobeHealth?: Record<string, unknown> | InsightsDashboardWardrobeHealth;
}

function dateOnly(date: Date) {
  return date.toISOString().split('T')[0];
}

function dayDiff(from: Date, to: Date) {
  return Math.floor((from.getTime() - to.getTime()) / MS_PER_DAY);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isNeutralHSL(hsl: [number, number, number]) {
  return hsl[1] < 15 || hsl[2] < 12 || hsl[2] > 90;
}

function getColorTemp(colorName: string) {
  const hsl = COLOR_HSL[normalizeText(colorName)];
  if (!hsl) return 'neutral' as const;
  if (isNeutralHSL(hsl)) return 'neutral' as const;
  const hue = hsl[0];
  if (hue <= 60 || hue >= 330) return 'warm' as const;
  if (hue >= 180 && hue < 330) return 'cool' as const;
  return hue < 120 ? 'warm' as const : 'cool' as const;
}

function computeColorTemperature(garments: Garment[]): ColorTemperatureData {
  let warmCount = 0;
  let coolCount = 0;
  let neutralCount = 0;

  for (const garment of garments) {
    const temperature = getColorTemp(garment.color_primary || '');
    if (temperature === 'warm') warmCount += 1;
    else if (temperature === 'cool') coolCount += 1;
    else neutralCount += 1;
  }

  const totalChromatic = warmCount + coolCount;
  const temperature = totalChromatic > 0 ? (warmCount - coolCount) / totalChromatic : 0;

  let dominantPalette: ColorTemperatureData['dominantPalette'] = 'balanced';
  if (totalChromatic === 0) dominantPalette = 'neutral';
  else if (temperature > 0.3) dominantPalette = 'warm';
  else if (temperature < -0.3) dominantPalette = 'cool';

  return { temperature, warmCount, coolCount, neutralCount, totalChromatic, dominantPalette };
}

function computeStyleDna(garments: Garment[], wearLogs: WearLogRow[]): StyleDNA | null {
  if (wearLogs.length < 5 || garments.length < 3) return null;

  const garmentMap = new Map(garments.map((garment) => [garment.id, garment]));
  const garmentIdsInLogs = new Set(wearLogs.map((log) => log.garment_id));
  const garmentsInLogs = garments.filter((garment) => garmentIdsInLogs.has(garment.id));
  if (garmentsInLogs.length < 3) return null;

  const colorCounts: Record<string, number> = {};
  let totalColorEntries = 0;

  for (const garment of garmentsInLogs) {
    const wearCount = wearLogs.filter((log) => log.garment_id === garment.id).length;
    if (!garment.color_primary || wearCount === 0) continue;
    colorCounts[garment.color_primary] = (colorCounts[garment.color_primary] || 0) + wearCount;
    totalColorEntries += wearCount;
  }

  const signatureColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color, count]) => ({
      color,
      percentage: totalColorEntries > 0 ? Math.round((count / totalColorEntries) * 100) : 0,
    }));

  const formalityValues = garmentsInLogs
    .filter((garment) => garment.formality != null)
    .map((garment) => garment.formality as number);

  const formalityCenter = formalityValues.length > 0
    ? Math.round((formalityValues.reduce((sum, value) => sum + value, 0) / formalityValues.length) * 10) / 10
    : 3;

  const formalityStd = formalityValues.length > 2
    ? Math.sqrt(
      formalityValues.reduce((sum, value) => sum + (value - formalityCenter) ** 2, 0) / formalityValues.length,
    )
    : 1;

  const formalitySpread: StyleDNA['formalitySpread'] =
    formalityStd < 0.8 ? 'narrow' : formalityStd < 1.5 ? 'moderate' : 'wide';

  const outfitGroups = new Map<string, string[]>();
  for (const log of wearLogs) {
    if (!log.outfit_id) continue;
    const garment = garmentMap.get(log.garment_id);
    if (!garment?.category) continue;
    if (!outfitGroups.has(log.outfit_id)) {
      outfitGroups.set(log.outfit_id, []);
    }
    outfitGroups.get(log.outfit_id)?.push(garment.category);
  }

  const comboCounter: Record<string, number> = {};
  for (const categories of outfitGroups.values()) {
    const combo = [...new Set(categories)].sort().join(' + ');
    if (!combo) continue;
    comboCounter[combo] = (comboCounter[combo] || 0) + 1;
  }

  const uniformCombos = Object.entries(comboCounter)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([combo, count]) => ({ combo: combo.split(' + '), count }));

  const neutralPct = signatureColors
    .filter((entry) => NEUTRAL_COLORS.includes(normalizeText(entry.color)))
    .reduce((sum, entry) => sum + entry.percentage, 0);

  const patterns: StyleDNAPattern[] = [];
  if (neutralPct >= 60) {
    patterns.push({
      label: 'Neutral palette',
      strength: Math.min(100, neutralPct),
      detail: `${neutralPct}% of your worn pieces stay in neutral tones.`,
    });
  }

  if (signatureColors[0]?.percentage >= 40) {
    patterns.push({
      label: 'Color loyalty',
      strength: signatureColors[0].percentage,
      detail: `${signatureColors[0].color} leads your rotation at ${signatureColors[0].percentage}%.`,
    });
  }

  if (uniformCombos[0]?.count >= 4) {
    patterns.push({
      label: 'Personal uniform',
      strength: Math.min(100, uniformCombos[0].count * 12),
      detail: `${uniformCombos[0].combo.join(' + ')} shows up ${uniformCombos[0].count} times.`,
    });
  }

  if (formalityCenter < 2.5) {
    patterns.push({
      label: 'Comfort-first',
      strength: Math.min(100, Math.round((3 - formalityCenter) * 40)),
      detail: 'Your wardrobe leans relaxed and easy to repeat.',
    });
  } else if (formalityCenter > 3.5) {
    patterns.push({
      label: 'Polished dresser',
      strength: Math.min(100, Math.round((formalityCenter - 3) * 40)),
      detail: 'You gravitate toward more structured, elevated looks.',
    });
  }

  const fitCounts: Record<string, number> = {};
  garmentsInLogs.forEach((garment) => {
    if (!garment.fit) return;
    fitCounts[garment.fit] = (fitCounts[garment.fit] || 0) + 1;
  });
  const topFit = Object.entries(fitCounts).sort((a, b) => b[1] - a[1])[0];
  if (topFit && topFit[1] / garmentsInLogs.length > 0.5) {
    patterns.push({
      label: `${topFit[0]} silhouette`,
      strength: Math.round((topFit[1] / garmentsInLogs.length) * 100),
      detail: `${Math.round((topFit[1] / garmentsInLogs.length) * 100)}% of your wardrobe shares that fit.`,
    });
  }

  let archetype = 'Versatile';
  if (neutralPct >= 70 && formalityCenter <= 3) archetype = 'Minimalist';
  else if (neutralPct >= 70 && formalityCenter > 3) archetype = 'Classic';
  else if (formalityCenter < 2.5) archetype = 'Casual Creative';
  else if (formalityCenter > 4) archetype = 'Sharp Dresser';
  else if (signatureColors[0] && !NEUTRAL_COLORS.includes(normalizeText(signatureColors[0].color))) archetype = 'Color Explorer';
  else if (uniformCombos[0]?.count >= 5) archetype = 'Uniform Builder';

  return {
    signatureColors,
    formalityCenter,
    formalitySpread,
    uniformCombos,
    patterns: patterns.sort((a, b) => b.strength - a.strength).slice(0, 4),
    archetype,
    outfitsAnalyzed: outfitGroups.size,
  };
}

function computeWeekRange(now: Date) {
  const start = new Date(now);
  const weekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function buildInsightsDashboardData(
  garments: Garment[],
  wearLogs: WearLogRow[],
  outfits: OutfitRow[],
  plannedOutfits: PlannedOutfitRow[],
  generatedAt = new Date(),
): InsightsDashboardData {
  const now = generatedAt;
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = dateOnly(thirtyDaysAgo);

  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = dateOnly(ninetyDaysAgo);

  const wearLogsLast30 = wearLogs.filter((log) => log.worn_at >= thirtyDaysAgoStr);
  const wearCountMap: Record<string, number> = {};
  wearLogsLast30.forEach((log) => {
    wearCountMap[log.garment_id] = (wearCountMap[log.garment_id] || 0) + 1;
  });

  const wornGarmentIds = new Set(Object.keys(wearCountMap));
  const totalGarments = garments.length;
  const usedGarments = garments
    .filter((garment) => wearCountMap[garment.id] != null)
    .map((garment) => ({ ...garment, wearCountLast30: wearCountMap[garment.id] || 0 }))
    .sort((a, b) => b.wearCountLast30 - a.wearCountLast30);

  const unusedGarments = garments.filter((garment) => !wornGarmentIds.has(garment.id));
  const forgottenGems = garments.filter((garment) => {
    if ((garment.wear_count || 0) <= 0) return false;
    if (!garment.last_worn_at) return true;
    return new Date(garment.last_worn_at) < sixtyDaysAgo;
  });

  const garmentsUsedLast30Days = wornGarmentIds.size;
  const usageRate = totalGarments > 0 ? Math.round((garmentsUsedLast30Days / totalGarments) * 100) : 0;
  const colorTemperature = computeColorTemperature(garments);

  const categoryCounts: Record<string, number> = {};
  garments.forEach((garment) => {
    const category = garment.category || 'other';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });
  const categoryBalance = Object.entries(categoryCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalGarments > 0 ? Math.round((count / totalGarments) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const { start: weekStart, end: weekEnd } = computeWeekRange(now);
  const plannedThisWeek = plannedOutfits.filter((outfit) => {
    const date = new Date(outfit.date);
    return date >= weekStart && date <= weekEnd;
  }).length;

  const outfitWearMap = new Map<string, { dates: Set<string>; lastWorn: string }>();
  wearLogs.forEach((log) => {
    if (!log.outfit_id) return;
    if (!outfitWearMap.has(log.outfit_id)) {
      outfitWearMap.set(log.outfit_id, { dates: new Set(), lastWorn: log.worn_at });
    }
    const entry = outfitWearMap.get(log.outfit_id)!;
    entry.dates.add(log.worn_at);
    if (log.worn_at > entry.lastWorn) entry.lastWorn = log.worn_at;
  });

  const repeats = outfits
    .filter((outfit) => outfitWearMap.has(outfit.id) && outfitWearMap.get(outfit.id)!.dates.size > 1)
    .map((outfit) => {
      const wearData = outfitWearMap.get(outfit.id)!;
      return {
        id: outfit.id,
        occasion: outfit.occasion || 'Saved look',
        wornCount: wearData.dates.size,
        lastWorn: wearData.lastWorn,
        daysSince: dayDiff(now, new Date(wearData.lastWorn)),
      };
    })
    .sort((a, b) => b.wornCount - a.wornCount)
    .slice(0, 5);

  const staleOutfits = outfits
    .map((outfit) => {
      const lastDate = outfitWearMap.get(outfit.id)?.lastWorn || outfit.worn_at || outfit.generated_at;
      return {
        id: outfit.id,
        occasion: outfit.occasion || 'Saved look',
        daysSince: lastDate ? dayDiff(now, new Date(lastDate)) : 999,
      };
    })
    .filter((outfit) => outfit.daysSince > 60)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  const wornDates = new Set(wearLogs.filter((log) => log.worn_at >= ninetyDaysAgoStr).map((log) => log.worn_at));
  const plannedDates = new Set(
    plannedOutfits
      .filter((outfit) => outfit.date >= ninetyDaysAgoStr && outfit.status === 'worn')
      .map((outfit) => outfit.date),
  );

  const heatmapDays: DashboardHeatmapDay[] = [];
  let streak = 0;
  let streakBroken = false;
  let daysWithOutfit = 0;
  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - index);
    const dateStr = dateOnly(date);
    const wasWorn = wornDates.has(dateStr);
    const wasPlanned = plannedDates.has(dateStr);
    const status = wasWorn && wasPlanned ? 'planned' : wasWorn ? 'improvised' : 'none';
    if (status !== 'none') daysWithOutfit += 1;
    heatmapDays.push({ date: dateStr, status });
  }
  for (let index = heatmapDays.length - 1; index >= 0; index -= 1) {
    if (heatmapDays[index].status !== 'none') {
      if (!streakBroken) streak += 1;
      continue;
    }
    if (index < heatmapDays.length - 1) streakBroken = true;
  }

  const styleDna = computeStyleDna(
    garments,
    wearLogs
      .slice()
      .sort((a, b) => b.worn_at.localeCompare(a.worn_at))
      .slice(0, 500),
  );

  const withPrice = garments.filter((garment) => (garment.purchase_price || 0) > 0);
  const spending = withPrice.length > 0
    ? (() => {
      const currency = withPrice[0].purchase_currency || 'SEK';
      const totalValue = withPrice.reduce((sum, garment) => sum + (garment.purchase_price || 0), 0);
      const breakdownMap: Record<string, { total: number; count: number }> = {};
      withPrice.forEach((garment) => {
        const category = garment.category || 'other';
        if (!breakdownMap[category]) {
          breakdownMap[category] = { total: 0, count: 0 };
        }
        breakdownMap[category].total += garment.purchase_price || 0;
        breakdownMap[category].count += 1;
      });
      const categoryBreakdown = Object.entries(breakdownMap)
        .map(([category, summary]) => ({ category, ...summary }))
        .sort((a, b) => b.total - a.total);

      const withCpw = withPrice
        .filter((garment) => (garment.wear_count || 0) > 0)
        .map((garment) => ({
          id: garment.id,
          title: garment.title,
          image_path: garment.image_path,
          cpw: Math.round(((garment.purchase_price || 0) / (garment.wear_count || 1)) * 100) / 100,
          wears: garment.wear_count || 0,
          price: garment.purchase_price || 0,
        }))
        .sort((a, b) => a.cpw - b.cpw);

      return {
        totalValue: Math.round(totalValue),
        currency,
        categoryBreakdown,
        topCostPerWear: withCpw.slice(0, 3),
        worstCostPerWear: withCpw.slice(-3).reverse(),
      };
    })()
    : null;

  const sustainability = totalGarments > 0
    ? (() => {
      const utilizationRate = usageRate;
      const avgWearCount = garments.reduce((sum, garment) => sum + (garment.wear_count || 0), 0) / totalGarments;
      const underusedCount = garments.filter((garment) => {
        if (!garment.last_worn_at) return true;
        return new Date(garment.last_worn_at) < sixtyDaysAgo;
      }).length;
      const utilizationScore = Math.min(utilizationRate, 100);
      const rewearScore = Math.min(avgWearCount * 10, 100);
      const underuseScore = Math.max(0, 100 - (underusedCount / totalGarments) * 100);
      return {
        score: Math.round(utilizationScore * 0.4 + rewearScore * 0.3 + underuseScore * 0.3),
        utilizationRate,
        avgWearCount: Math.round(avgWearCount * 10) / 10,
        underusedCount,
        totalGarments,
      };
    })()
    : null;

  return {
    behavior: {
      consistency: Math.round((daysWithOutfit / 90) * 100),
      heatmapDays,
      repeats,
      staleOutfits,
      streak,
    },
    generatedAt: now.toISOString(),
    metricVersion: METRIC_VERSION,
    overview: {
      totalGarments,
      garmentsUsedLast30Days,
      unusedGarmentsLast30Days: Math.max(totalGarments - garmentsUsedLast30Days, 0),
      usageRate,
      savedLooks: outfits.filter((outfit) => outfit.saved).length,
      plannedThisWeek,
    },
    styleDna,
    value: {
      spending,
      sustainability,
    },
    wardrobeHealth: {
      categoryBalance,
      colorTemperature,
      forgottenGems,
      topFiveWorn: usedGarments.slice(0, 5),
      unusedGarments,
      usedGarments,
    },
  };
}

async function buildFallbackInsightsDashboard(userId: string): Promise<InsightsDashboardData> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const { start: weekStart } = computeWeekRange(now);

  const [garmentsRes, wearLogsRes, outfitsRes, plannedOutfitsRes] = await Promise.all([
    supabase.from('garments').select('*').eq('user_id', userId),
    supabase
      .from('wear_logs')
      .select('garment_id, occasion, outfit_id, worn_at')
      .eq('user_id', userId)
      .gte('worn_at', dateOnly(oneYearAgo)),
    supabase.from('outfits').select('generated_at, id, occasion, saved, worn_at').eq('user_id', userId),
    supabase
      .from('planned_outfits')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', dateOnly(weekStart < ninetyDaysAgo ? weekStart : ninetyDaysAgo)),
  ]);

  if (garmentsRes.error) throw garmentsRes.error;
  if (wearLogsRes.error) throw wearLogsRes.error;
  if (outfitsRes.error) throw outfitsRes.error;
  if (plannedOutfitsRes.error) throw plannedOutfitsRes.error;

  return buildInsightsDashboardData(
    garmentsRes.data || [],
    wearLogsRes.data || [],
    outfitsRes.data || [],
    plannedOutfitsRes.data || [],
    now,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function normalizeGarmentList(value: unknown, wearCountKey = 'wearCountLast30') {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const garment = asRecord(item);
    if (!garment) return null;
    return {
      ...(garment as unknown as Garment),
      wearCountLast30: Number(garment.wearCountLast30 ?? garment.wear_count_last_30_days ?? garment[wearCountKey] ?? 0),
    };
  }).filter((item): item is Garment & { wearCountLast30: number } => item != null);
}

function normalizeSimpleGarments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null)
    .map((item) => item as unknown as Garment);
}

function normalizeStyleDnaPayload(value: unknown): StyleDNA | null {
  const source = asRecord(value);
  if (!source || source.ready === false) return null;

  const signatureColors = Array.isArray(source.signatureColors)
    ? source.signatureColors
    : Array.isArray(source.signature_colors)
      ? source.signature_colors
      : [];

  const uniformCombos = Array.isArray(source.uniformCombos)
    ? source.uniformCombos
    : Array.isArray(source.uniform_combos)
      ? source.uniform_combos
      : [];

  const patterns = Array.isArray(source.patterns) ? source.patterns : [];
  const looksAnalyzed = Number(source.outfitsAnalyzed ?? source.looks_analyzed ?? 0);
  const formalityCenter = Number(source.formalityCenter ?? source.formality_center ?? 3);
  const formalitySpread = (source.formalitySpread ?? source.formality_spread ?? 'moderate') as StyleDNA['formalitySpread'];

  if (!source.archetype && looksAnalyzed <= 0 && signatureColors.length === 0) return null;

  return {
    archetype: String(source.archetype ?? 'Versatile'),
    signatureColors: signatureColors.map((entry) => {
      const item = asRecord(entry) ?? {};
      return {
        color: String(item.color ?? 'unknown'),
        percentage: Number(item.percentage ?? 0),
      };
    }),
    formalityCenter,
    formalitySpread,
    uniformCombos: uniformCombos.map((entry) => {
      const item = asRecord(entry) ?? {};
      return {
        combo: Array.isArray(item.combo) ? item.combo.map((part) => String(part)) : [],
        count: Number(item.count ?? 0),
      };
    }),
    patterns: patterns.map((entry) => {
      const item = asRecord(entry) ?? {};
      return {
        label: String(item.label ?? ''),
        strength: Number(item.strength ?? 0),
        detail: String(item.detail ?? ''),
      };
    }),
    outfitsAnalyzed: looksAnalyzed,
  };
}

function normalizeDashboardResponse(raw: RawInsightsDashboardData | null): InsightsDashboardData | null {
  if (!raw) return null;

  const overviewSource = asRecord(raw.overview);
  const behaviorSource = asRecord(raw.behavior);
  const valueSource = asRecord(raw.value);
  const wardrobeHealthSource = asRecord(raw.wardrobeHealth ?? raw.wardrobe_health);
  if (!overviewSource || !behaviorSource || !valueSource || !wardrobeHealthSource) return null;

  const usageLast30 = asRecord(behaviorSource.usage_last_30_days);
  const wearHeatmap = asRecord(behaviorSource.wear_heatmap);
  const outfitRepeats = asRecord(behaviorSource.outfit_repeats);
  const categoryBalanceSource = asRecord(wardrobeHealthSource.category_balance);
  const rotationSource = asRecord(wardrobeHealthSource.rotation);
  const colorTemperatureSource = asRecord(wardrobeHealthSource.color_temperature);
  const spendingSource = asRecord(valueSource.spending);
  const sustainabilitySource = asRecord(valueSource.sustainability);

  const usedGarments = normalizeGarmentList(
    usageLast30?.used_garments ?? wardrobeHealthSource.usedGarments ?? [],
  );
  const unusedGarments = normalizeSimpleGarments(
    usageLast30?.unused_garments ?? rotationSource?.forgotten_gems ?? wardrobeHealthSource.unusedGarments ?? [],
  );

  return {
    behavior: {
      consistency: Number(wearHeatmap?.consistency ?? 0),
      heatmapDays: Array.isArray(wearHeatmap?.days)
        ? wearHeatmap!.days.map((entry) => {
          const item = asRecord(entry) ?? {};
          return {
            date: String(item.date ?? ''),
            status: (item.status ?? 'none') as DashboardHeatmapDay['status'],
          };
        })
        : [],
      repeats: Array.isArray(outfitRepeats?.repeats)
        ? outfitRepeats!.repeats.map((entry) => {
          const item = asRecord(entry) ?? {};
          return {
            id: String(item.id ?? ''),
            occasion: String(item.occasion ?? 'Saved look'),
            wornCount: Number(item.worn_count ?? item.wornCount ?? 0),
            lastWorn: String(item.last_worn ?? item.lastWorn ?? ''),
            daysSince: Number(item.days_since_last_worn ?? item.daysSince ?? 0),
          };
        })
        : [],
      staleOutfits: Array.isArray(outfitRepeats?.stale_outfits)
        ? outfitRepeats!.stale_outfits.map((entry) => {
          const item = asRecord(entry) ?? {};
          return {
            id: String(item.id ?? ''),
            occasion: String(item.occasion ?? 'Saved look'),
            daysSince: Number(item.days_since_last_worn ?? item.daysSince ?? 0),
          };
        })
        : [],
      streak: Number(wearHeatmap?.streak ?? 0),
    },
    generatedAt: raw.generated_at || new Date().toISOString(),
    metricVersion: raw.metric_version || METRIC_VERSION,
    overview: {
      totalGarments: Number(overviewSource.total_garments ?? overviewSource.totalGarments ?? 0),
      garmentsUsedLast30Days: Number(overviewSource.garments_used_last_30_days ?? overviewSource.garmentsUsedLast30Days ?? usedGarments.length),
      unusedGarmentsLast30Days: Number(overviewSource.garments_unused_last_30_days ?? overviewSource.unusedGarmentsLast30Days ?? unusedGarments.length),
      usageRate: Number(overviewSource.usage_rate_last_30_days ?? overviewSource.usageRate ?? 0),
      savedLooks: Number(overviewSource.total_saved_outfits ?? overviewSource.savedLooks ?? 0),
      plannedThisWeek: Number(overviewSource.planned_this_week ?? overviewSource.plannedThisWeek ?? 0),
    },
    styleDna: normalizeStyleDnaPayload(raw.styleDna ?? raw.style_dna),
    value: {
      spending: spendingSource
        ? {
          totalValue: Number(spendingSource.total_value ?? spendingSource.totalValue ?? 0),
          currency: String(spendingSource.currency ?? 'SEK'),
          categoryBreakdown: Array.isArray(spendingSource.category_breakdown)
            ? spendingSource.category_breakdown.map((entry) => {
              const item = asRecord(entry) ?? {};
              return {
                category: String(item.category ?? 'other'),
                total: Number(item.total ?? 0),
                count: Number(item.count ?? 0),
              };
            })
            : [],
          topCostPerWear: Array.isArray(spendingSource.best_cost_per_wear)
            ? spendingSource.best_cost_per_wear.map((entry) => {
              const item = asRecord(entry) ?? {};
              return {
                id: String(item.id ?? ''),
                title: (item.title as string | null | undefined) ?? null,
                image_path: (item.image_path as string | null | undefined) ?? null,
                cpw: Number(item.cost_per_wear ?? item.cpw ?? 0),
                wears: Number(item.wear_count ?? item.wears ?? 0),
                price: Number(item.purchase_price ?? item.price ?? 0),
              };
            })
            : [],
          worstCostPerWear: Array.isArray(spendingSource.highest_cost_per_wear)
            ? spendingSource.highest_cost_per_wear.map((entry) => {
              const item = asRecord(entry) ?? {};
              return {
                id: String(item.id ?? ''),
                title: (item.title as string | null | undefined) ?? null,
                image_path: (item.image_path as string | null | undefined) ?? null,
                cpw: Number(item.cost_per_wear ?? item.cpw ?? 0),
                wears: Number(item.wear_count ?? item.wears ?? 0),
                price: Number(item.purchase_price ?? item.price ?? 0),
              };
            })
            : [],
        }
        : null,
      sustainability: sustainabilitySource
        ? {
          score: Number(sustainabilitySource.score ?? 0),
          utilizationRate: Number(sustainabilitySource.utilization_rate ?? sustainabilitySource.utilizationRate ?? 0),
          avgWearCount: Number(sustainabilitySource.average_wear_count ?? sustainabilitySource.avgWearCount ?? 0),
          underusedCount: Number(sustainabilitySource.underused_count_60_days ?? sustainabilitySource.underusedCount ?? 0),
          totalGarments: Number(sustainabilitySource.total_garments ?? sustainabilitySource.totalGarments ?? 0),
        }
        : null,
    },
    wardrobeHealth: {
      categoryBalance: Array.isArray(categoryBalanceSource?.categories)
        ? categoryBalanceSource!.categories.map((entry) => {
          const item = asRecord(entry) ?? {};
          return {
            name: String(item.name ?? 'other'),
            count: Number(item.count ?? 0),
            percentage: Number(item.percentage ?? 0),
          };
        })
        : [],
      colorTemperature: {
        temperature: Number(colorTemperatureSource?.temperature ?? 0),
        warmCount: Number(colorTemperatureSource?.warm_count ?? 0),
        coolCount: Number(colorTemperatureSource?.cool_count ?? 0),
        neutralCount: Number(colorTemperatureSource?.neutral_count ?? 0),
        totalChromatic: Number(colorTemperatureSource?.total_chromatic ?? 0),
        dominantPalette: (colorTemperatureSource?.dominant_palette ?? 'balanced') as ColorTemperatureData['dominantPalette'],
      },
      forgottenGems: normalizeSimpleGarments(rotationSource?.forgotten_gems ?? []),
      topFiveWorn: normalizeGarmentList(
        overviewSource.top_worn_garments_last_30_days ?? wardrobeHealthSource.topFiveWorn ?? [],
      ).slice(0, 5),
      unusedGarments,
      usedGarments,
    },
  };
}

export function toInsightsData(dashboard: InsightsDashboardData | null): InsightsData | null {
  if (!dashboard) return null;
  return {
    totalGarments: dashboard.overview.totalGarments,
    garmentsUsedLast30Days: dashboard.overview.garmentsUsedLast30Days,
    usageRate: dashboard.overview.usageRate,
    topFiveWorn: dashboard.wardrobeHealth.topFiveWorn,
    usedGarments: dashboard.wardrobeHealth.usedGarments,
    unusedGarments: dashboard.wardrobeHealth.unusedGarments,
    colorTemperature: dashboard.wardrobeHealth.colorTemperature,
  };
}

export function toStyleDna(dashboard: InsightsDashboardData | null) {
  return dashboard?.styleDna ?? null;
}

export function useInsightsDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['insights-dashboard', user?.id],
    queryFn: async (): Promise<InsightsDashboardData | null> => {
      if (!user) return null;

      const { data, error } = await invokeEdgeFunction<RawInsightsDashboardData>('insights_dashboard', {
        body: {},
        retries: 1,
        timeout: 20_000,
      });

      if (!error) {
        const normalized = normalizeDashboardResponse(data);
        if (normalized) return normalized;
      }

      return buildFallbackInsightsDashboard(user.id);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
