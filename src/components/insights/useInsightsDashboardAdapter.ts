import { useMemo } from 'react';

import type {
  DashboardHeatmapDay,
  DashboardRepeatOutfit,
  DashboardSpendingGarment,
  DashboardStaleOutfit,
  Garment,
  InsightsDashboardData,
  StyleDNA,
} from '@/hooks/useInsightsDashboard';
import { useInsightsDashboard } from '@/hooks/useInsightsDashboard';
import { useSubscription } from '@/hooks/useSubscription';

const COLOR_SWATCHES: Record<string, string> = {
  beige: '#d7c5a3',
  black: '#171717',
  blue: '#4b6fb4',
  brown: '#6b4a34',
  burgundy: '#6f2435',
  camel: '#b28b5c',
  coral: '#cf7354',
  cream: '#efe4d1',
  gray: '#7c7b7b',
  green: '#5f7d63',
  grey: '#7c7b7b',
  khaki: '#97916a',
  lavender: '#a798c9',
  lila: '#8d72c9',
  marinbla: '#223256',
  mint: '#a4cdbf',
  mintgron: '#a4cdbf',
  mustard: '#b98c32',
  navy: '#223256',
  olive: '#65703e',
  olivgron: '#65703e',
  orange: '#c46d33',
  pink: '#ca91aa',
  purple: '#7358b5',
  red: '#a34740',
  rosa: '#ca91aa',
  sage: '#8d9b84',
  salvia: '#8d9b84',
  svart: '#171717',
  taupe: '#8a7769',
  terracotta: '#9f5f47',
  terrakotta: '#9f5f47',
  vinrod: '#6f2435',
  vit: '#f3efe7',
  white: '#f3efe7',
  yellow: '#d5ad43',
  bla: '#4b6fb4',
  brun: '#6b4a34',
  gra: '#7c7b7b',
  gron: '#5f7d63',
  gul: '#d5ad43',
  kramvit: '#efe4d1',
  lavendel: '#a798c9',
  rod: '#a34740',
};

const CATEGORY_LABELS: Record<string, string> = {
  accessory: 'Accessories',
  accessories: 'Accessories',
  bag: 'Bags',
  bags: 'Bags',
  blazer: 'Blazers',
  blazers: 'Blazers',
  bottom: 'Bottoms',
  bottoms: 'Bottoms',
  coat: 'Coats',
  coats: 'Coats',
  dress: 'Dresses',
  dresses: 'Dresses',
  jacket: 'Jackets',
  jackets: 'Jackets',
  jeans: 'Jeans',
  knitwear: 'Knitwear',
  outerwear: 'Outerwear',
  pants: 'Pants',
  shoes: 'Shoes',
  shirt: 'Shirts',
  shirts: 'Shirts',
  skirt: 'Skirts',
  skirts: 'Skirts',
  sneaker: 'Sneakers',
  sneakers: 'Sneakers',
  sweater: 'Sweaters',
  sweaters: 'Sweaters',
  top: 'Tops',
  tops: 'Tops',
  trouser: 'Trousers',
  trousers: 'Trousers',
  t_shirt: 'T-shirts',
  't-shirt': 'T-shirts',
};

type PageState = 'loading' | 'ready' | 'empty' | 'no-wear-data' | 'error';
type ActionTarget =
  | { kind: 'pricing' }
  | { kind: 'gaps'; autorun?: boolean }
  | { kind: 'outfit'; outfitId: string }
  | { kind: 'style-garment'; garmentId: string }
  | { kind: 'generate-garments'; garmentIds: string[] };

export interface InsightsSpotlightGarment {
  id: string;
  title: string;
  imagePath: string | null;
  eyebrow: string;
  detail: string;
  meta: string;
}

export interface InsightsColorEntry {
  color: string;
  label: string;
  count: number;
  percentage: number;
  swatch: string;
}

export interface InsightsFormulaEntry {
  label: string;
  count: number;
}

export interface InsightsMetricRail {
  label: string;
  value: number;
  max: number;
}

export interface InsightsMetric {
  label: string;
  value: string;
  hint: string;
  rails: InsightsMetricRail[];
}

export interface InsightsActionItem {
  id: string;
  title: string;
  detail: string;
  cta: string;
  tone: 'neutral' | 'positive' | 'warning';
  target: ActionTarget;
}

interface InsightsValueSpotlight extends InsightsSpotlightGarment {
  cpwLabel: string;
  cpwValue: number;
}

export interface InsightsDashboardViewModel {
  state: PageState;
  isPremium: boolean;
  isRefreshing: boolean;
  generatedAtLabel: string | null;
  hero: {
    score: number;
    summary: string;
    eyebrow: string;
    title: string;
    metrics: InsightsMetric[];
  };
  style: {
    ready: boolean;
    archetype: string;
    caption: string;
    formalityLabel: string;
    formalityValue: string;
    formalityCenter: number | null;
    formalitySpread: StyleDNA['formalitySpread'] | null;
    signatureColors: InsightsColorEntry[];
    formulas: InsightsFormulaEntry[];
    patterns: Array<{ label: string; strength: number; detail: string }>;
  };
  palette: {
    summary: string;
    dominantLabel: string;
    warmCount: number;
    coolCount: number;
    neutralCount: number;
    totalCount: number;
    entries: InsightsColorEntry[];
    bars: InsightsColorEntry[];
    locked: boolean;
  };
  behavior: {
    streak: number;
    consistency: number;
    repeats: DashboardRepeatOutfit[];
    staleOutfits: DashboardStaleOutfit[];
    heatmapDays: DashboardHeatmapDay[];
    locked: boolean;
  };
  health: {
    categoryBalance: Array<{
      name: string;
      label: string;
      count: number;
      percentage: number;
    }>;
    forgottenGems: InsightsSpotlightGarment[];
    topPerformers: InsightsSpotlightGarment[];
    usedCount: number;
    unusedCount: number;
    totalCount: number;
    pressureLabel: string;
    pressureDetail: string;
  };
  value: {
    hasSpendData: boolean;
    totalValue: string;
    avgCostPerWear: string;
    bestCostPerWear: InsightsValueSpotlight | null;
    worstCostPerWear: InsightsValueSpotlight | null;
    sustainabilityScore: number | null;
    utilizationLabel: string;
    efficiencyLabel: string;
    utilizationRate: number | null;
    avgWearCount: number | null;
    locked: boolean;
  };
  actions: InsightsActionItem[];
  upgrade: {
    show: boolean;
    title: string;
    detail: string;
    cta: string;
  };
}

interface BuildViewModelParams {
  dashboard: InsightsDashboardData | null;
  isPremium: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  locale?: string;
}

function startCase(value: string | null | undefined) {
  if (!value) return 'Unknown';
  const normalized = value.replace(/[_-]+/g, ' ').trim();
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function categoryLabel(value: string | null | undefined) {
  if (!value) return 'Category';
  const key = value.toLowerCase();
  return CATEGORY_LABELS[key] ?? startCase(value);
}

function colorLabel(value: string) {
  return startCase(value);
}

function colorSwatch(value: string) {
  return COLOR_SWATCHES[value.toLowerCase().trim()] ?? '#8b8b89';
}

function dominantPaletteLabel(
  dominantPalette: InsightsDashboardData['wardrobeHealth']['colorTemperature']['dominantPalette'],
) {
  if (dominantPalette === 'warm') return 'Warm-led palette';
  if (dominantPalette === 'cool') return 'Cool-led palette';
  if (dominantPalette === 'neutral') return 'Neutral-led palette';
  return 'Balanced palette';
}

function buildColorEntries(garments: Garment[]) {
  const counts = new Map<string, number>();
  for (const garment of garments) {
    const color = (garment.color_primary || 'unknown').toLowerCase();
    counts.set(color, (counts.get(color) || 0) + 1);
  }

  const total = garments.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([color, count]) => ({
      color,
      label: colorLabel(color),
      count,
      percentage: Math.round((count / total) * 100),
      swatch: colorSwatch(color),
    }));
}

function garmentSpotlight(
  garment: Garment | (DashboardSpendingGarment & { image_path: string | null; title: string | null }) | null | undefined,
  config: { eyebrow: string; detail: string; meta: string },
): InsightsSpotlightGarment | null {
  if (!garment) return null;
  return {
    id: garment.id,
    title: garment.title || 'Untitled piece',
    imagePath: garment.image_path || null,
    eyebrow: config.eyebrow,
    detail: config.detail,
    meta: config.meta,
  };
}

function formatCurrency(value: number | null | undefined, currency: string, locale = 'en') {
  if (value == null || Number.isNaN(value)) return 'Unavailable';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: value >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

function getGeneratedAtLabel(timestamp: string | null | undefined, locale = 'en') {
  if (!timestamp) return null;

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

function formatShortDate(value: string | null | undefined, locale = 'en') {
  if (!value) return 'Not worn recently';

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildHeroSummary(dashboard: InsightsDashboardData, styleDna: StyleDNA | null) {
  const usageRate = dashboard.overview.usageRate;
  const dormantCount = dashboard.wardrobeHealth.unusedGarments.length;
  const leadFormula = styleDna?.uniformCombos[0];

  if (dashboard.overview.garmentsUsedLast30Days === 0) {
    return 'Start logging wear to unlock behavior, formulas, and value.';
  }

  if (dormantCount > 0) {
    return `${dormantCount} pieces are dormant right now and ready for rotation.`;
  }

  if (leadFormula) {
    return `${leadFormula.combo.join(' + ')} is the clearest formula in your wardrobe.`;
  }

  if (usageRate > 0) {
    return `${usageRate}% of the wardrobe was active in the last 30 days.`;
  }

  return 'Wear history is starting to take shape.';
}

function buildStyleCaption(dna: StyleDNA | null) {
  if (!dna) return 'Style DNA appears once enough outfits repeat.';
  if (dna.patterns[0]?.detail) return dna.patterns[0].detail;
  if (dna.uniformCombos[0]) return `${dna.uniformCombos[0].combo.join(' + ')} repeats ${dna.uniformCombos[0].count} times.`;
  return `${dna.archetype} is starting to emerge through repeat wear.`;
}

function formalitySummary(dna: StyleDNA | null) {
  if (!dna) {
    return {
      label: 'Still forming',
      value: 'Need more repeat wear',
      center: null,
      spread: null,
    };
  }

  const spreadLabel = dna.formalitySpread === 'narrow'
    ? 'Focused range'
    : dna.formalitySpread === 'wide'
      ? 'Wide range'
      : 'Balanced range';

  const centerLabel = dna.formalityCenter <= 2.5
    ? 'Leans relaxed'
    : dna.formalityCenter >= 3.8
      ? 'Leans polished'
      : 'Moves across casual and elevated';

  return {
    label: spreadLabel,
    value: `${centerLabel} / ${dna.formalityCenter.toFixed(1)} of 5`,
    center: dna.formalityCenter,
    spread: dna.formalitySpread,
  };
}

function buildPressureDetail(dashboard: InsightsDashboardData) {
  const total = dashboard.overview.totalGarments;
  const unused = dashboard.wardrobeHealth.unusedGarments.length;
  const topCategory = dashboard.wardrobeHealth.categoryBalance[0];

  if (total === 0) {
    return {
      label: 'No wardrobe data yet',
      detail: 'Add garments to read balance and rotation.',
    };
  }

  if (unused / total >= 0.45) {
    return {
      label: 'High dormant share',
      detail: `${unused} of ${total} pieces are currently inactive.`,
    };
  }

  if (topCategory && topCategory.percentage >= 35) {
    return {
      label: 'Category concentration',
      detail: `${categoryLabel(topCategory.name)} holds ${topCategory.percentage}% of the wardrobe.`,
    };
  }

  return {
    label: 'Healthy spread',
    detail: 'Rotation and coverage are reasonably balanced.',
  };
}

function buildActions(
  dashboard: InsightsDashboardData,
  viewModel: Omit<InsightsDashboardViewModel, 'actions' | 'upgrade' | 'state' | 'isPremium' | 'isRefreshing' | 'generatedAtLabel'>,
): InsightsActionItem[] {
  const forgotten = dashboard.wardrobeHealth.forgottenGems[0] ?? dashboard.wardrobeHealth.unusedGarments[0] ?? null;
  const underusedIds = dashboard.wardrobeHealth.unusedGarments.slice(0, 6).map((garment) => garment.id);
  const staleOutfit = dashboard.behavior.staleOutfits[0] ?? null;
  const gapPressure = viewModel.health.pressureLabel !== 'Healthy spread';

  const actions: InsightsActionItem[] = [];

  if (forgotten) {
    actions.push({
      id: 'forgotten-piece',
      title: `Style ${forgotten.title || 'a forgotten piece'}`,
      detail: 'Bring one dormant garment back into rotation.',
      cta: 'Style forgotten piece',
      tone: 'warning',
      target: { kind: 'style-garment', garmentId: forgotten.id },
    });
  }

  if (underusedIds.length > 0) {
    actions.push({
      id: 'underused-generation',
      title: 'Generate from underused pieces',
      detail: 'Start with dormant garments instead of the usual staples.',
      cta: 'Generate outfits',
      tone: 'neutral',
      target: { kind: 'generate-garments', garmentIds: underusedIds },
    });
  }

  if (staleOutfit) {
    actions.push({
      id: 'stale-outfit',
      title: `Rotate ${staleOutfit.occasion}`,
      detail: `${staleOutfit.daysSince} days since this saved outfit was last worn.`,
      cta: 'Open stale outfit',
      tone: 'neutral',
      target: { kind: 'outfit', outfitId: staleOutfit.id },
    });
  }

  if (gapPressure) {
    actions.push({
      id: 'gap-scan',
      title: 'Fill wardrobe gaps',
      detail: 'Run the gap scan to find the category or silhouette under pressure.',
      cta: 'Open gap scan',
      tone: 'warning',
      target: { kind: 'gaps', autorun: true },
    });
  }

  return actions.slice(0, 4);
}

function createLoadingViewModel(isPremium: boolean, isRefreshing: boolean): InsightsDashboardViewModel {
  return {
    state: 'loading',
    isPremium,
    isRefreshing,
    generatedAtLabel: null,
    hero: {
      score: 0,
      summary: '',
      eyebrow: 'Wardrobe intelligence',
      title: 'Wardrobe operating view.',
      metrics: [],
    },
    style: {
      ready: false,
      archetype: 'Style DNA',
      caption: '',
      formalityLabel: 'Still forming',
      formalityValue: 'Need more wear data',
      formalityCenter: null,
      formalitySpread: null,
      signatureColors: [],
      formulas: [],
      patterns: [],
    },
    palette: {
      summary: '',
      dominantLabel: 'Balanced palette',
      warmCount: 0,
      coolCount: 0,
      neutralCount: 0,
      totalCount: 0,
      entries: [],
      bars: [],
      locked: !isPremium,
    },
    behavior: {
      streak: 0,
      consistency: 0,
      repeats: [],
      staleOutfits: [],
      heatmapDays: [],
      locked: !isPremium,
    },
    health: {
      categoryBalance: [],
      forgottenGems: [],
      topPerformers: [],
      usedCount: 0,
      unusedCount: 0,
      totalCount: 0,
      pressureLabel: 'Loading',
      pressureDetail: '',
    },
    value: {
      hasSpendData: false,
      totalValue: 'Unavailable',
      avgCostPerWear: 'Unavailable',
      bestCostPerWear: null,
      worstCostPerWear: null,
      sustainabilityScore: null,
      utilizationLabel: 'Unavailable',
      efficiencyLabel: 'Unavailable',
      utilizationRate: null,
      avgWearCount: null,
      locked: !isPremium,
    },
    actions: [],
    upgrade: {
      show: !isPremium,
      title: 'Unlock premium depth',
      detail: 'Open richer behavior, palette, and value diagnostics once you upgrade.',
      cta: 'View premium',
    },
  };
}

export function createInsightsDashboardViewModel({
  dashboard,
  isPremium,
  isLoading,
  isRefreshing,
  hasError,
  locale = 'en',
}: BuildViewModelParams): InsightsDashboardViewModel {
  if (isLoading) {
    return createLoadingViewModel(isPremium, isRefreshing);
  }

  if (hasError && !dashboard) {
    return {
      ...createLoadingViewModel(isPremium, isRefreshing),
      state: 'error',
      hero: {
        score: 0,
        summary: 'Insights could not be refreshed right now. Pull to refresh and try again.',
        eyebrow: 'Wardrobe intelligence',
        title: 'Insights unavailable',
        metrics: [],
      },
    };
  }

  if (!dashboard || dashboard.overview.totalGarments === 0) {
    return {
      ...createLoadingViewModel(isPremium, isRefreshing),
      state: 'empty',
      hero: {
        score: 0,
        summary: 'Add a wardrobe first. Insights starts once BURS can read your real closet.',
        eyebrow: 'Wardrobe intelligence',
        title: 'No wardrobe yet',
        metrics: [],
      },
    };
  }

  const styleDna = dashboard.styleDna;
  const allGarments = [
    ...dashboard.wardrobeHealth.usedGarments,
    ...dashboard.wardrobeHealth.unusedGarments.filter(
      (garment) => !dashboard.wardrobeHealth.usedGarments.some((used) => used.id === garment.id),
    ),
  ];
  const paletteEntries = buildColorEntries(allGarments);
  const formality = formalitySummary(styleDna);
  const pressure = buildPressureDetail(dashboard);
  const spending = dashboard.value.spending;
  const currency = spending?.currency || 'SEK';
  const pricedGarments = allGarments.filter((garment) => (garment.purchase_price || 0) > 0);
  const totalWearsAcrossPriced = pricedGarments.reduce((sum, garment) => sum + (garment.wear_count || 0), 0);
  const avgCostPerWear = spending && totalWearsAcrossPriced > 0
    ? spending.totalValue / totalWearsAcrossPriced
    : null;
  const formulaCount = styleDna?.uniformCombos.length ?? 0;
  const looksToFormulaMax = Math.max(dashboard.overview.savedLooks, formulaCount, 1);

  const bestCostPerWear = spending?.topCostPerWear[0]
    ? {
      ...garmentSpotlight(spending.topCostPerWear[0], {
        eyebrow: 'Best cost per wear',
        detail: `${spending.topCostPerWear[0].wears} wears`,
        meta: formatCurrency(spending.topCostPerWear[0].price, currency, locale),
      })!,
      cpwLabel: formatCurrency(spending.topCostPerWear[0].cpw, currency, locale),
      cpwValue: spending.topCostPerWear[0].cpw,
    }
    : null;

  const worstCostPerWear = spending?.worstCostPerWear[0]
    ? {
      ...garmentSpotlight(spending.worstCostPerWear[0], {
        eyebrow: 'Needs more rotation',
        detail: `${spending.worstCostPerWear[0].wears} wears`,
        meta: formatCurrency(spending.worstCostPerWear[0].price, currency, locale),
      })!,
      cpwLabel: formatCurrency(spending.worstCostPerWear[0].cpw, currency, locale),
      cpwValue: spending.worstCostPerWear[0].cpw,
    }
    : null;

  const viewModelBase = {
    hero: {
      score: dashboard.value.sustainability?.score ?? dashboard.overview.usageRate,
      summary: buildHeroSummary(dashboard, styleDna),
      eyebrow: 'Wardrobe intelligence',
      title: 'Wardrobe operating view.',
      metrics: [
        {
          label: 'Active 30d',
          value: `${dashboard.overview.garmentsUsedLast30Days}/${dashboard.overview.totalGarments}`,
          hint: 'Pieces in active rotation',
          rails: [
            {
              label: 'Active',
              value: dashboard.overview.garmentsUsedLast30Days,
              max: Math.max(dashboard.overview.totalGarments, 1),
            },
          ],
        },
        {
          label: 'Usage rate',
          value: `${dashboard.overview.usageRate}%`,
          hint: 'Wardrobe touched in the last month',
          rails: [
            {
              label: 'Usage',
              value: dashboard.overview.usageRate,
              max: 100,
            },
          ],
        },
        {
          label: 'Looks / formulas',
          value: `${dashboard.overview.savedLooks} / ${formulaCount}`,
          hint: 'Saved looks and recurring formulas',
          rails: [
            {
              label: 'Looks',
              value: dashboard.overview.savedLooks,
              max: looksToFormulaMax,
            },
            {
              label: 'Formulas',
              value: formulaCount,
              max: looksToFormulaMax,
            },
          ],
        },
      ],
    },
    style: {
      ready: Boolean(styleDna),
      archetype: styleDna?.archetype ?? 'Style DNA still forming',
      caption: buildStyleCaption(styleDna),
      formalityLabel: formality.label,
      formalityValue: formality.value,
      formalityCenter: formality.center,
      formalitySpread: formality.spread,
      signatureColors: (styleDna?.signatureColors ?? paletteEntries).slice(0, 5).map((entry) => ({
        color: entry.color,
        label: colorLabel(entry.color),
        count: 'count' in entry ? entry.count : entry.percentage,
        percentage: entry.percentage,
        swatch: colorSwatch(entry.color),
      })),
      formulas: (styleDna?.uniformCombos ?? []).slice(0, 4).map((formula) => ({
        label: formula.combo.join(' + '),
        count: formula.count,
      })),
      patterns: (styleDna?.patterns ?? []).slice(0, 4),
    },
    palette: {
      summary: `${dominantPaletteLabel(dashboard.wardrobeHealth.colorTemperature.dominantPalette)} with ${paletteEntries[0]?.label?.toLowerCase() ?? 'neutral tones'} leading.`,
      dominantLabel: dominantPaletteLabel(dashboard.wardrobeHealth.colorTemperature.dominantPalette),
      warmCount: dashboard.wardrobeHealth.colorTemperature.warmCount,
      coolCount: dashboard.wardrobeHealth.colorTemperature.coolCount,
      neutralCount: dashboard.wardrobeHealth.colorTemperature.neutralCount,
      totalCount: allGarments.length,
      entries: paletteEntries,
      bars: paletteEntries.slice(0, 5),
      locked: !isPremium,
    },
    behavior: {
      streak: dashboard.behavior.streak,
      consistency: dashboard.behavior.consistency,
      repeats: dashboard.behavior.repeats.slice(0, 4),
      staleOutfits: dashboard.behavior.staleOutfits.slice(0, 4),
      heatmapDays: dashboard.behavior.heatmapDays,
      locked: !isPremium,
    },
    health: {
      categoryBalance: dashboard.wardrobeHealth.categoryBalance.slice(0, 6).map((item) => ({
        ...item,
        label: categoryLabel(item.name),
      })),
      forgottenGems: dashboard.wardrobeHealth.forgottenGems.slice(0, 3).map((garment) => garmentSpotlight(garment, {
        eyebrow: 'Forgotten gem',
        detail: categoryLabel(garment.category),
        meta: `Last worn ${formatShortDate(garment.last_worn_at, locale)}`,
      })!).filter(Boolean),
      topPerformers: dashboard.wardrobeHealth.topFiveWorn.slice(0, 3).map((garment) => garmentSpotlight(garment, {
        eyebrow: 'Top performer',
        detail: `${garment.wearCountLast30} wears in 30d`,
        meta: categoryLabel(garment.category),
      })!).filter(Boolean),
      usedCount: dashboard.wardrobeHealth.usedGarments.length,
      unusedCount: dashboard.wardrobeHealth.unusedGarments.length,
      totalCount: dashboard.overview.totalGarments,
      pressureLabel: pressure.label,
      pressureDetail: pressure.detail,
    },
    value: {
      hasSpendData: Boolean(spending),
      totalValue: spending ? formatCurrency(spending.totalValue, currency, locale) : 'No price history yet',
      avgCostPerWear: avgCostPerWear != null ? formatCurrency(avgCostPerWear, currency, locale) : 'Need price and wear data',
      bestCostPerWear,
      worstCostPerWear,
      sustainabilityScore: dashboard.value.sustainability?.score ?? null,
      utilizationLabel: dashboard.value.sustainability ? `${dashboard.value.sustainability.utilizationRate}% active` : 'Need wear data',
      efficiencyLabel: dashboard.value.sustainability ? `${dashboard.value.sustainability.avgWearCount.toFixed(1)} average wears` : 'Need wear data',
      utilizationRate: dashboard.value.sustainability?.utilizationRate ?? null,
      avgWearCount: dashboard.value.sustainability?.avgWearCount ?? null,
      locked: !isPremium,
    },
  };

  return {
    state: dashboard.overview.garmentsUsedLast30Days === 0 ? 'no-wear-data' : 'ready',
    isPremium,
    isRefreshing,
    generatedAtLabel: getGeneratedAtLabel(dashboard.generatedAt, locale),
    ...viewModelBase,
    actions: buildActions(dashboard, viewModelBase),
    upgrade: {
      show: !isPremium,
      title: 'Unlock premium depth',
      detail: 'See deeper palette, behavior, and value context without leaving Insights.',
      cta: 'View premium',
    },
  };
}

export function useInsightsDashboardAdapter() {
  const dashboardQuery = useInsightsDashboard();
  const subscription = useSubscription();

  return useMemo(
    () => createInsightsDashboardViewModel({
      dashboard: dashboardQuery.data ?? null,
      isPremium: subscription.isPremium,
      isLoading: dashboardQuery.isLoading || subscription.isLoading,
      isRefreshing: dashboardQuery.isFetching,
      hasError: dashboardQuery.isError,
    }),
    [
      dashboardQuery.data,
      dashboardQuery.isError,
      dashboardQuery.isFetching,
      dashboardQuery.isLoading,
      subscription.isLoading,
      subscription.isPremium,
    ],
  );
}
