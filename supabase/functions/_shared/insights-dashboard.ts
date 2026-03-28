export const INSIGHTS_METRIC_VERSION = "2026-03-28.v1";

export interface GarmentInsightRow {
  id: string;
  title: string;
  image_path: string | null;
  category: string;
  subcategory: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[] | null;
  wear_count: number | null;
  last_worn_at: string | null;
  created_at: string | null;
  purchase_price: number | null;
  purchase_currency: string | null;
}

export interface WearLogInsightRow {
  garment_id: string;
  outfit_id: string | null;
  worn_at: string;
  occasion: string | null;
  event_title: string | null;
}

export interface OutfitInsightRow {
  id: string;
  occasion: string;
  worn_at: string | null;
  generated_at: string | null;
  saved: boolean | null;
}

export interface PlannedOutfitInsightRow {
  date: string;
  status: string;
  outfit_id: string | null;
}

export interface InsightsDashboardInput {
  generated_at: string;
  garments: GarmentInsightRow[];
  wear_logs_last_30_days: WearLogInsightRow[];
  wear_logs_last_90_days: WearLogInsightRow[];
  wear_logs_last_180_days: WearLogInsightRow[];
  wear_logs_recent_500: WearLogInsightRow[];
  wear_logs_for_outfit_history: Array<Pick<WearLogInsightRow, "outfit_id" | "worn_at">>;
  outfits: OutfitInsightRow[];
  planned_outfits_last_90_days: PlannedOutfitInsightRow[];
}

interface GarmentSummary {
  id: string;
  title: string;
  image_path: string | null;
  category: string;
  subcategory: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  fit: string | null;
  formality: number | null;
  season_tags: string[];
  wear_count: number;
  wear_count_last_30_days: number;
  last_worn_at: string | null;
  created_at: string | null;
  purchase_price: number | null;
  purchase_currency: string | null;
}

interface DashboardInsight {
  code: string;
  severity: "info" | "positive" | "warning";
  title: string;
  detail: string;
}

interface ColorTemperatureSection {
  temperature: number;
  warm_count: number;
  cool_count: number;
  neutral_count: number;
  total_chromatic: number;
  dominant_palette: "warm" | "cool" | "neutral" | "balanced";
}

interface InsightsDashboardPayload {
  generated_at: string;
  metric_version: string;
  overview: Record<string, unknown>;
  style_dna: Record<string, unknown>;
  wardrobe_health: Record<string, unknown>;
  behavior: Record<string, unknown>;
  value: Record<string, unknown>;
}

const COLOR_HSL: Record<string, [number, number, number]> = {
  svart: [0, 0, 5],
  black: [0, 0, 5],
  vit: [0, 0, 97],
  white: [0, 0, 97],
  gra: [0, 0, 50],
  gray: [0, 0, 50],
  grey: [0, 0, 50],
  beige: [40, 30, 80],
  marin: [220, 60, 20],
  navy: [220, 60, 20],
  brun: [25, 50, 30],
  brown: [25, 50, 30],
  bla: [220, 70, 50],
  blue: [220, 70, 50],
  rod: [0, 80, 45],
  red: [0, 80, 45],
  rosa: [330, 60, 70],
  pink: [330, 60, 70],
  gron: [130, 60, 40],
  green: [130, 60, 40],
  gul: [50, 80, 55],
  yellow: [50, 80, 55],
  orange: [25, 85, 55],
  lila: [270, 60, 50],
  purple: [270, 60, 50],
  vinrod: [345, 60, 30],
  burgundy: [345, 60, 30],
  khaki: [55, 30, 55],
  kamel: [30, 45, 55],
  camel: [30, 45, 55],
  olivgron: [80, 40, 35],
  olive: [80, 40, 35],
  korall: [15, 70, 60],
  coral: [15, 70, 60],
  lavendel: [270, 40, 70],
  lavender: [270, 40, 70],
  senapsgul: [45, 70, 45],
  mustard: [45, 70, 45],
  terrakotta: [15, 55, 45],
  terracotta: [15, 55, 45],
  taupe: [30, 15, 55],
  kramvit: [40, 25, 93],
  cream: [40, 25, 93],
  mint: [160, 50, 70],
  mintgron: [160, 50, 70],
  salvia: [140, 20, 55],
  sage: [140, 20, 55],
};

const NEUTRAL_COLORS = new Set([
  "black",
  "svart",
  "white",
  "vit",
  "grey",
  "gray",
  "gra",
  "beige",
  "navy",
  "marin",
  "taupe",
  "cream",
  "kramvit",
  "camel",
  "kamel",
  "brown",
  "brun",
]);

const SEASONS = ["spring", "summer", "fall", "winter"] as const;

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return toIsoDate(date);
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDays(from: string | null | undefined, to: Date = new Date()): number | null {
  const fromDate = parseIsoDate(from);
  if (!fromDate) return null;
  return Math.floor((to.getTime() - fromDate.getTime()) / 86400000);
}

function buildWearCountMap(logs: Array<Pick<WearLogInsightRow, "garment_id">>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    counts.set(log.garment_id, (counts.get(log.garment_id) || 0) + 1);
  }
  return counts;
}

function summarizeGarment(garment: GarmentInsightRow, wearCounts30: Map<string, number>): GarmentSummary {
  return {
    id: garment.id,
    title: garment.title,
    image_path: garment.image_path,
    category: garment.category,
    subcategory: garment.subcategory,
    color_primary: garment.color_primary,
    color_secondary: garment.color_secondary,
    material: garment.material,
    fit: garment.fit,
    formality: garment.formality,
    season_tags: garment.season_tags || [],
    wear_count: garment.wear_count || 0,
    wear_count_last_30_days: wearCounts30.get(garment.id) || 0,
    last_worn_at: garment.last_worn_at,
    created_at: garment.created_at,
    purchase_price: garment.purchase_price,
    purchase_currency: garment.purchase_currency,
  };
}

function isNeutral(hsl: [number, number, number]): boolean {
  return hsl[1] < 15 || hsl[2] < 12 || hsl[2] > 90;
}

function getColorTemperature(colorName: string | null): "warm" | "cool" | "neutral" {
  const hsl = COLOR_HSL[normalizeText(colorName)];
  if (!hsl) return "neutral";
  if (isNeutral(hsl)) return "neutral";
  const hue = hsl[0];
  if (hue <= 60 || hue >= 330) return "warm";
  if (hue >= 180 && hue < 330) return "cool";
  return hue < 120 ? "warm" : "cool";
}

function computeColorTemperature(garments: GarmentInsightRow[]): ColorTemperatureSection {
  let warmCount = 0;
  let coolCount = 0;
  let neutralCount = 0;

  for (const garment of garments) {
    const temperature = getColorTemperature(garment.color_primary);
    if (temperature === "warm") warmCount += 1;
    else if (temperature === "cool") coolCount += 1;
    else neutralCount += 1;
  }

  const totalChromatic = warmCount + coolCount;
  const balance = totalChromatic > 0 ? (warmCount - coolCount) / totalChromatic : 0;

  let dominantPalette: ColorTemperatureSection["dominant_palette"] = "balanced";
  if (totalChromatic === 0) dominantPalette = "neutral";
  else if (balance > 0.3) dominantPalette = "warm";
  else if (balance < -0.3) dominantPalette = "cool";

  return {
    temperature: roundTo(balance, 2),
    warm_count: warmCount,
    cool_count: coolCount,
    neutral_count: neutralCount,
    total_chromatic: totalChromatic,
    dominant_palette: dominantPalette,
  };
}

function categoryFamily(garment: GarmentInsightRow): "top" | "bottom" | "outerwear" | "shoes" | "dress" | "accessory" | "other" {
  const haystack = `${normalizeText(garment.category)} ${normalizeText(garment.subcategory)}`;

  if (/(dress|jumpsuit|klanning|overall)/.test(haystack)) return "dress";
  if (/(outerwear|jacket|coat|blazer|parka|windbreaker|jacka|kappa|rock)/.test(haystack)) return "outerwear";
  if (/(shoe|sneaker|boot|loafer|sandal|heel|skor|stovlar)/.test(haystack)) return "shoes";
  if (/(bottom|pant|jean|trouser|short|skirt|chino|byxor|kjol)/.test(haystack)) return "bottom";
  if (/(top|shirt|t-shirt|tee|blouse|sweater|hoodie|polo|tank|cardigan|troja|skjorta)/.test(haystack)) return "top";
  if (/(accessory|bag|belt|hat|scarf|jewelry|smycke)/.test(haystack)) return "accessory";
  return "other";
}

function formalitySpreadLabel(values: number[], center: number | null): "narrow" | "moderate" | "wide" | null {
  if (!center || values.length < 2) return null;
  const stddev = Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / values.length);
  if (stddev < 0.8) return "narrow";
  if (stddev < 1.5) return "moderate";
  return "wide";
}

function computeStyleDna(
  garments: GarmentInsightRow[],
  recentWearLogs: WearLogInsightRow[],
): Record<string, unknown> {
  if (recentWearLogs.length < 5) {
    return {
      ready: false,
      archetype: null,
      signature_colors: [],
      formality_center: null,
      formality_spread: null,
      uniform_combos: [],
      patterns: [],
      looks_analyzed: 0,
      source: {
        max_recent_wear_logs: 500,
        wear_logs_considered: recentWearLogs.length,
        unique_garments_considered: 0,
      },
    };
  }

  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const recentGarmentIds = new Set<string>();
  const colorCounts = new Map<string, number>();
  const outfitGroups = new Map<string, string[]>();

  for (const log of recentWearLogs) {
    const garment = garmentById.get(log.garment_id);
    if (!garment) continue;
    recentGarmentIds.add(garment.id);

    const colorKey = garment.color_primary || "unknown";
    colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);

    if (!log.outfit_id) continue;
    const groupKey = `${log.outfit_id}:${log.worn_at}`;
    const group = outfitGroups.get(groupKey) || [];
    group.push(normalizeText(garment.category) || "unknown");
    outfitGroups.set(groupKey, group);
  }

  const recentGarments = [...recentGarmentIds]
    .map((garmentId) => garmentById.get(garmentId))
    .filter((garment): garment is GarmentInsightRow => Boolean(garment));

  const totalColorEntries = [...colorCounts.values()].reduce((sum, count) => sum + count, 0);
  const signatureColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([color, count]) => ({
      color,
      percentage: totalColorEntries > 0 ? Math.round((count / totalColorEntries) * 100) : 0,
      wear_count: count,
    }));

  const formalityValues = recentGarments
    .map((garment) => garment.formality)
    .filter((value): value is number => typeof value === "number");
  const formalityCenter = formalityValues.length > 0
    ? roundTo(formalityValues.reduce((sum, value) => sum + value, 0) / formalityValues.length, 1)
    : null;

  const uniformComboCounts = new Map<string, number>();
  for (const categories of outfitGroups.values()) {
    const combo = [...new Set(categories)].sort().join(" + ");
    if (!combo) continue;
    uniformComboCounts.set(combo, (uniformComboCounts.get(combo) || 0) + 1);
  }
  const uniformCombos = [...uniformComboCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([combo, count]) => ({ combo: combo.split(" + "), count }));

  const neutralPercentage = signatureColors
    .filter((entry) => NEUTRAL_COLORS.has(normalizeText(entry.color)))
    .reduce((sum, entry) => sum + entry.percentage, 0);

  const fitCounts = new Map<string, number>();
  for (const garment of recentGarments) {
    const fit = normalizeText(garment.fit);
    if (!fit) continue;
    fitCounts.set(fit, (fitCounts.get(fit) || 0) + 1);
  }
  const topFit = [...fitCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;

  const patterns: Array<{ label: string; strength: number; detail: string }> = [];
  if (neutralPercentage >= 60) {
    patterns.push({
      label: "Neutral palette",
      strength: Math.min(100, neutralPercentage),
      detail: `${neutralPercentage}% of recent wears stay in neutral tones`,
    });
  }
  if (signatureColors[0]?.percentage >= 40) {
    patterns.push({
      label: "Color loyalty",
      strength: signatureColors[0].percentage,
      detail: `${signatureColors[0].color} leads ${signatureColors[0].percentage}% of recent wears`,
    });
  }
  if (uniformCombos[0]?.count >= 4) {
    patterns.push({
      label: "Personal uniform",
      strength: Math.min(100, uniformCombos[0].count * 12),
      detail: `${uniformCombos[0].combo.join(" + ")} repeated ${uniformCombos[0].count} times`,
    });
  }
  if (typeof formalityCenter === "number" && formalityCenter < 2.5) {
    patterns.push({
      label: "Comfort-first",
      strength: Math.min(100, Math.round((3 - formalityCenter) * 40)),
      detail: "Recent wear history leans relaxed and easy",
    });
  } else if (typeof formalityCenter === "number" && formalityCenter > 3.5) {
    patterns.push({
      label: "Polished dresser",
      strength: Math.min(100, Math.round((formalityCenter - 3) * 40)),
      detail: "Recent wear history leans structured and elevated",
    });
  }
  if (topFit && recentGarments.length > 0 && topFit[1] / recentGarments.length > 0.5) {
    const ratio = Math.round((topFit[1] / recentGarments.length) * 100);
    patterns.push({
      label: `${topFit[0]} silhouette`,
      strength: ratio,
      detail: `${ratio}% of recently worn garments share a ${topFit[0]} fit`,
    });
  }

  let archetype = "Versatile";
  if (neutralPercentage >= 70 && typeof formalityCenter === "number" && formalityCenter <= 3) archetype = "Minimalist";
  else if (neutralPercentage >= 70 && typeof formalityCenter === "number" && formalityCenter > 3) archetype = "Classic";
  else if (typeof formalityCenter === "number" && formalityCenter < 2.5) archetype = "Casual Creative";
  else if (typeof formalityCenter === "number" && formalityCenter > 4) archetype = "Sharp Dresser";
  else if (signatureColors[0] && !NEUTRAL_COLORS.has(normalizeText(signatureColors[0].color))) archetype = "Color Explorer";
  else if (uniformCombos[0]?.count >= 5) archetype = "Uniform Builder";

  return {
    ready: true,
    archetype,
    signature_colors: signatureColors,
    formality_center: formalityCenter,
    formality_spread: formalitySpreadLabel(formalityValues, formalityCenter),
    uniform_combos: uniformCombos,
    patterns: patterns.sort((a, b) => b.strength - a.strength).slice(0, 4),
    looks_analyzed: outfitGroups.size,
    source: {
      max_recent_wear_logs: 500,
      wear_logs_considered: recentWearLogs.length,
      unique_garments_considered: recentGarments.length,
      weighting: {
        signature_colors: "wear_log_weighted",
        formality_center: "unique_recent_garments",
      },
    },
  };
}

function computeWardrobeHealth(
  garments: GarmentInsightRow[],
  usedGarments30: GarmentSummary[],
  unusedGarments30: GarmentSummary[],
): Record<string, unknown> {
  const categoryCounts = new Map<string, number>();
  const coreSlots = {
    tops: 0,
    bottoms: 0,
    dresses: 0,
    outerwear: 0,
    shoes: 0,
    accessories: 0,
    other: 0,
  };

  for (const garment of garments) {
    const category = normalizeText(garment.category) || "other";
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    switch (categoryFamily(garment)) {
      case "top":
        coreSlots.tops += 1;
        break;
      case "bottom":
        coreSlots.bottoms += 1;
        break;
      case "dress":
        coreSlots.dresses += 1;
        break;
      case "outerwear":
        coreSlots.outerwear += 1;
        break;
      case "shoes":
        coreSlots.shoes += 1;
        break;
      case "accessory":
        coreSlots.accessories += 1;
        break;
      default:
        coreSlots.other += 1;
        break;
    }
  }

  const categoryBalance = [...categoryCounts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      percentage: garments.length > 0 ? Math.round((count / garments.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const seasonCoverage: Record<(typeof SEASONS)[number], number> = {
    spring: 0,
    summer: 0,
    fall: 0,
    winter: 0,
  };
  for (const garment of garments) {
    for (const tag of garment.season_tags || []) {
      const normalized = normalizeText(tag);
      if (normalized === "autumn" || normalized === "host") seasonCoverage.fall += 1;
      if (normalized === "spring" || normalized === "var") seasonCoverage.spring += 1;
      if (normalized === "summer" || normalized === "sommar") seasonCoverage.summer += 1;
      if (normalized === "winter" || normalized === "vinter") seasonCoverage.winter += 1;
    }
  }
  const weakSeasons = SEASONS.filter((season) => seasonCoverage[season] < 3);

  const overWorn = usedGarments30
    .filter((garment) => garment.wear_count_last_30_days >= 8)
    .slice(0, 5);

  const underusedCutoff = daysAgo(60);
  const underusedCount = garments.filter((garment) => !garment.last_worn_at || garment.last_worn_at < underusedCutoff).length;

  const forgottenGems = [...unusedGarments30]
    .sort((a, b) => {
      const aDays = diffDays(a.last_worn_at) ?? Number.POSITIVE_INFINITY;
      const bDays = diffDays(b.last_worn_at) ?? Number.POSITIVE_INFINITY;
      if (bDays !== aDays) return bDays - aDays;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 12);

  const insights: DashboardInsight[] = [];
  if (coreSlots.tops > 0 && coreSlots.bottoms > 0 && coreSlots.tops / coreSlots.bottoms > 3) {
    insights.push({
      code: "top_heavy",
      severity: "warning",
      title: "Top-heavy wardrobe",
      detail: `${coreSlots.tops} tops against ${coreSlots.bottoms} bottoms is limiting outfit variety.`,
    });
  }
  if (coreSlots.outerwear === 0 && garments.length >= 10) {
    insights.push({
      code: "no_outerwear",
      severity: "warning",
      title: "No outerwear coverage",
      detail: "Adding a jacket or coat would unlock more layered combinations.",
    });
  }
  if (coreSlots.shoes <= 1 && garments.length >= 10) {
    insights.push({
      code: "limited_footwear",
      severity: "warning",
      title: "Limited footwear range",
      detail: "Another pair of shoes would expand outfit coverage quickly.",
    });
  }
  if (weakSeasons.length > 0 && garments.length >= 10) {
    insights.push({
      code: "seasonal_gaps",
      severity: "warning",
      title: `Thin seasonal coverage: ${weakSeasons.join(", ")}`,
      detail: weakSeasons.map((season) => `${season} (${seasonCoverage[season]})`).join(", "),
    });
  }
  if (overWorn.length > 0) {
    insights.push({
      code: "heavy_rotation",
      severity: "info",
      title: `${overWorn.length} staple${overWorn.length > 1 ? "s" : ""} on heavy rotation`,
      detail: overWorn.slice(0, 2).map((garment) => `${garment.title} (${garment.wear_count_last_30_days}x)`).join(", "),
    });
  }
  if (unusedGarments30.length > garments.length * 0.5 && garments.length >= 8) {
    insights.push({
      code: "high_unused_share",
      severity: "warning",
      title: `${Math.round((unusedGarments30.length / garments.length) * 100)}% of wardrobe unused`,
      detail: "A large share of the closet has not been worn in the last 30 days.",
    });
  } else if (unusedGarments30.length > 5) {
    insights.push({
      code: "forgotten_pieces",
      severity: "info",
      title: `${unusedGarments30.length} forgotten pieces`,
      detail: "These items are available for easy rediscovery.",
    });
  }
  if (!insights.some((insight) => insight.severity === "warning") && garments.length >= 15) {
    insights.push({
      code: "well_balanced",
      severity: "positive",
      title: "Well-balanced wardrobe",
      detail: "Category coverage and rotation look healthy.",
    });
  }

  return {
    category_balance: {
      total_garments: garments.length,
      categories: categoryBalance,
      core_slots: coreSlots,
    },
    season_coverage: {
      counts: seasonCoverage,
      weak_seasons: weakSeasons,
    },
    color_temperature: computeColorTemperature(garments),
    rotation: {
      overused_staples: overWorn,
      underused_count_60_days: underusedCount,
      forgotten_gems: forgottenGems,
    },
    insights: insights.slice(0, 6),
  };
}

function computeWearHeatmap(
  wearLogs90: WearLogInsightRow[],
  plannedOutfits90: PlannedOutfitInsightRow[],
): Record<string, unknown> {
  const wornDates = new Set(wearLogs90.map((log) => log.worn_at));
  const plannedDates = new Set(
    plannedOutfits90
      .filter((planned) => normalizeText(planned.status) === "worn")
      .map((planned) => planned.date),
  );

  const days: Array<{ date: string; status: "planned" | "improvised" | "none" }> = [];
  const today = new Date();
  let streak = 0;
  let streakBroken = false;
  let daysWithOutfit = 0;

  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - index);
    const dateString = toIsoDate(date);
    const worn = wornDates.has(dateString);
    const planned = plannedDates.has(dateString);

    if (worn && planned) {
      days.push({ date: dateString, status: "planned" });
      daysWithOutfit += 1;
    } else if (worn) {
      days.push({ date: dateString, status: "improvised" });
      daysWithOutfit += 1;
    } else {
      days.push({ date: dateString, status: "none" });
    }
  }

  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].status !== "none") {
      if (!streakBroken) streak += 1;
    } else if (index < days.length - 1) {
      streakBroken = true;
    }
  }

  return {
    window_days: 90,
    streak,
    consistency: Math.round((daysWithOutfit / 90) * 100),
    days,
  };
}

function computeOutfitRepeats(
  outfits: OutfitInsightRow[],
  wearLogsForOutfitHistory: Array<Pick<WearLogInsightRow, "outfit_id" | "worn_at">>,
): Record<string, unknown> {
  const savedOutfits = outfits.filter((outfit) => outfit.saved === true);
  const wearCounts = new Map<string, { dates: Set<string>; last_worn: string }>();

  for (const log of wearLogsForOutfitHistory) {
    if (!log.outfit_id) continue;
    const current = wearCounts.get(log.outfit_id);
    if (!current) {
      wearCounts.set(log.outfit_id, { dates: new Set([log.worn_at]), last_worn: log.worn_at });
      continue;
    }
    current.dates.add(log.worn_at);
    if (log.worn_at > current.last_worn) current.last_worn = log.worn_at;
  }

  const now = new Date();
  const repeats = savedOutfits
    .filter((outfit) => (wearCounts.get(outfit.id)?.dates.size || 0) > 1)
    .map((outfit) => {
      const stats = wearCounts.get(outfit.id)!;
      return {
        id: outfit.id,
        occasion: outfit.occasion,
        worn_count: stats.dates.size,
        last_worn: stats.last_worn,
        days_since_last_worn: diffDays(stats.last_worn, now) ?? 0,
      };
    })
    .sort((a, b) => b.worn_count - a.worn_count || a.id.localeCompare(b.id))
    .slice(0, 5);

  const staleOutfits = savedOutfits
    .map((outfit) => {
      const lastDate = wearCounts.get(outfit.id)?.last_worn || outfit.worn_at || outfit.generated_at;
      return {
        id: outfit.id,
        occasion: outfit.occasion,
        last_worn: lastDate,
        days_since_last_worn: diffDays(lastDate, now) ?? 999,
      };
    })
    .filter((outfit) => outfit.days_since_last_worn > 60)
    .sort((a, b) => b.days_since_last_worn - a.days_since_last_worn || a.id.localeCompare(b.id))
    .slice(0, 5);

  return {
    repeats,
    stale_outfits: staleOutfits,
  };
}

function computeStyleEvolution(
  garments: GarmentInsightRow[],
  wearLogs180: WearLogInsightRow[],
): Record<string, unknown> {
  const garmentById = new Map(garments.map((garment) => [garment.id, garment]));
  const months = new Map<string, {
    colors: Map<string, number>;
    categories: Map<string, number>;
    formality_sum: number;
    count: number;
  }>();

  for (const log of wearLogs180) {
    const garment = garmentById.get(log.garment_id);
    if (!garment) continue;
    const monthKey = log.worn_at.slice(0, 7);
    const bucket = months.get(monthKey) || {
      colors: new Map<string, number>(),
      categories: new Map<string, number>(),
      formality_sum: 0,
      count: 0,
    };
    const color = garment.color_primary || "unknown";
    const category = normalizeText(garment.category) || "unknown";
    bucket.colors.set(color, (bucket.colors.get(color) || 0) + 1);
    bucket.categories.set(category, (bucket.categories.get(category) || 0) + 1);
    bucket.formality_sum += garment.formality ?? 3;
    bucket.count += 1;
    months.set(monthKey, bucket);
  }

  const timeline = [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      const topColor = [...data.colors.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "unknown";
      const topCategory = [...data.categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "unknown";
      return {
        month,
        top_color: topColor,
        top_category: topCategory,
        avg_formality: data.count > 0 ? roundTo(data.formality_sum / data.count, 1) : 0,
        wear_log_count: data.count,
      };
    });

  return {
    months_analyzed: timeline.length,
    timeline,
  };
}

function mostCommonCurrency(garments: GarmentInsightRow[]): string {
  const counts = new Map<string, number>();
  for (const garment of garments) {
    const currency = garment.purchase_currency?.trim();
    if (!currency) continue;
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "SEK";
}

function computeValueSection(
  garments: GarmentInsightRow[],
  wearCounts30: Map<string, number>,
): Record<string, unknown> {
  const pricedGarments = garments.filter((garment) => (garment.purchase_price || 0) > 0);
  const currency = mostCommonCurrency(pricedGarments);
  const totalValue = roundTo(pricedGarments.reduce((sum, garment) => sum + (garment.purchase_price || 0), 0), 2);

  const categoryTotals = new Map<string, { total: number; count: number }>();
  for (const garment of pricedGarments) {
    const category = normalizeText(garment.category) || "other";
    const current = categoryTotals.get(category) || { total: 0, count: 0 };
    current.total += garment.purchase_price || 0;
    current.count += 1;
    categoryTotals.set(category, current);
  }

  const categoryBreakdown = [...categoryTotals.entries()]
    .map(([category, stats]) => ({
      category,
      total: roundTo(stats.total, 2),
      count: stats.count,
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

  const withCostPerWear = pricedGarments
    .filter((garment) => (garment.wear_count || 0) > 0)
    .map((garment) => ({
      id: garment.id,
      title: garment.title,
      image_path: garment.image_path,
      cost_per_wear: roundTo((garment.purchase_price || 0) / Math.max(garment.wear_count || 1, 1), 2),
      wear_count: garment.wear_count || 0,
      purchase_price: garment.purchase_price || 0,
      purchase_currency: garment.purchase_currency || currency,
    }))
    .sort((a, b) => a.cost_per_wear - b.cost_per_wear || a.title.localeCompare(b.title));

  const wornGarmentIds30 = new Set(wearCounts30.keys());
  const utilizationRate = garments.length > 0 ? Math.round((wornGarmentIds30.size / garments.length) * 100) : 0;
  const averageWearCount = garments.length > 0
    ? roundTo(garments.reduce((sum, garment) => sum + (garment.wear_count || 0), 0) / garments.length, 1)
    : 0;
  const underusedCutoff = daysAgo(60);
  const underusedCount = garments.filter((garment) => !garment.last_worn_at || garment.last_worn_at < underusedCutoff).length;

  const utilizationScore = Math.min(utilizationRate, 100);
  const rewearScore = Math.min(averageWearCount * 10, 100);
  const underuseScore = garments.length > 0 ? Math.max(0, 100 - (underusedCount / garments.length) * 100) : 0;
  const sustainabilityScore = Math.round((utilizationScore * 0.4) + (rewearScore * 0.3) + (underuseScore * 0.3));

  return {
    spending: pricedGarments.length > 0
      ? {
        available: true,
        total_value: totalValue,
        currency,
        priced_items_count: pricedGarments.length,
        category_breakdown: categoryBreakdown,
        best_cost_per_wear: withCostPerWear.slice(0, 3),
        highest_cost_per_wear: withCostPerWear.slice(-3).reverse(),
      }
      : null,
    sustainability: garments.length > 0
      ? {
        score: sustainabilityScore,
        utilization_rate: utilizationRate,
        average_wear_count: averageWearCount,
        underused_count_60_days: underusedCount,
        total_garments: garments.length,
        formula: {
          utilization_weight: 0.4,
          rewear_weight: 0.3,
          underuse_weight: 0.3,
        },
      }
      : null,
  };
}

function countPlannedThisWeek(plannedOutfits: PlannedOutfitInsightRow[]): number {
  const now = new Date();
  const weekStart = new Date(now);
  const weekday = (weekStart.getUTCDay() + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - weekday);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return plannedOutfits.filter((outfit) => {
    const outfitDate = parseIsoDate(outfit.date);
    if (!outfitDate) return false;
    return outfitDate >= weekStart && outfitDate <= weekEnd;
  }).length;
}

export function buildInsightsDashboard(input: InsightsDashboardInput): InsightsDashboardPayload {
  const wearCounts30 = buildWearCountMap(input.wear_logs_last_30_days);
  const garments = input.garments;
  const garmentSummaries = garments.map((garment) => summarizeGarment(garment, wearCounts30));

  const usedGarments30 = garmentSummaries
    .filter((garment) => garment.wear_count_last_30_days > 0)
    .sort((a, b) => b.wear_count_last_30_days - a.wear_count_last_30_days || a.title.localeCompare(b.title));

  const unusedGarments30 = garmentSummaries
    .filter((garment) => garment.wear_count_last_30_days === 0)
    .sort((a, b) => {
      const aDays = diffDays(a.last_worn_at) ?? Number.POSITIVE_INFINITY;
      const bDays = diffDays(b.last_worn_at) ?? Number.POSITIVE_INFINITY;
      if (bDays !== aDays) return bDays - aDays;
      return a.title.localeCompare(b.title);
    });

  const distinctUsedGarmentIds30 = new Set(input.wear_logs_last_30_days.map((log) => log.garment_id));
  const styleDna = computeStyleDna(garments, input.wear_logs_recent_500);
  const styleDnaReady = Boolean(styleDna["ready"]);

  return {
    generated_at: input.generated_at,
    metric_version: INSIGHTS_METRIC_VERSION,
    overview: {
      total_garments: garments.length,
      total_saved_outfits: input.outfits.filter((outfit) => outfit.saved === true).length,
      planned_this_week: countPlannedThisWeek(input.planned_outfits_last_90_days),
      garments_used_last_30_days: distinctUsedGarmentIds30.size,
      garments_unused_last_30_days: unusedGarments30.length,
      usage_rate_last_30_days: garments.length > 0 ? Math.round((distinctUsedGarmentIds30.size / garments.length) * 100) : 0,
      top_worn_garments_last_30_days: usedGarments30.slice(0, 5),
      forgotten_gems_preview: unusedGarments30.slice(0, 6),
      style_dna_ready: styleDnaReady,
    },
    style_dna: styleDna,
    wardrobe_health: computeWardrobeHealth(garments, usedGarments30, unusedGarments30),
    behavior: {
      usage_last_30_days: {
        window_days: 30,
        wear_log_count: input.wear_logs_last_30_days.length,
        garments_used_count: distinctUsedGarmentIds30.size,
        used_garments: usedGarments30,
        unused_garments: unusedGarments30,
      },
      wear_heatmap: computeWearHeatmap(input.wear_logs_last_90_days, input.planned_outfits_last_90_days),
      outfit_repeats: computeOutfitRepeats(input.outfits, input.wear_logs_for_outfit_history),
      style_evolution: computeStyleEvolution(garments, input.wear_logs_last_180_days),
    },
    value: computeValueSection(garments, wearCounts30),
  };
}
