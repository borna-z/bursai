import { useMemo } from 'react';

import { toInsightsData, type Garment, useInsightsDashboard } from '@/hooks/useInsightsDashboard';
import { useSubscription } from '@/hooks/useSubscription';

const COLOR_MAP: Record<string, string> = {
  black: 'bg-gray-900',
  white: 'bg-gray-100',
  grey: 'bg-gray-400',
  navy: 'bg-blue-900',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-600',
  beige: 'bg-amber-100',
  brown: 'bg-amber-800',
  pink: 'bg-pink-400',
  purple: 'bg-purple-500',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-500',
  svart: 'bg-gray-900',
  vit: 'bg-gray-100',
  'gr\u00e5': 'bg-gray-400',
  'marinbl\u00e5': 'bg-blue-900',
  'bl\u00e5': 'bg-blue-500',
  'r\u00f6d': 'bg-red-500',
  'gr\u00f6n': 'bg-green-600',
  brun: 'bg-amber-800',
  rosa: 'bg-pink-400',
  lila: 'bg-purple-500',
  gul: 'bg-yellow-400',
};

export interface DashboardColorBar {
  color: string;
  count: number;
  colorClass: string;
}

export function useInsightsDashboardAdapter() {
  const dashboardQuery = useInsightsDashboard();
  const subscription = useSubscription();

  const insights = useMemo(() => toInsightsData(dashboardQuery.data ?? null), [dashboardQuery.data]);
  const dna = dashboardQuery.data?.styleDna ?? null;
  const sustainability = dashboardQuery.data?.value.sustainability ?? null;

  const allGarments = useMemo(() => {
    if (!dashboardQuery.data) return [];

    const garmentMap = new Map<string, Garment & { wearCountLast30?: number }>();
    for (const garment of dashboardQuery.data.wardrobeHealth.usedGarments) {
      garmentMap.set(garment.id, garment);
    }
    for (const garment of dashboardQuery.data.wardrobeHealth.unusedGarments) {
      garmentMap.set(garment.id, garment);
    }
    return Array.from(garmentMap.values());
  }, [dashboardQuery.data]);

  const colorBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const garment of allGarments) {
      const color = (garment.color_primary || 'unknown').toLowerCase();
      counts.set(color, (counts.get(color) || 0) + 1);
    }

    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      total: allGarments.length,
      entries,
      bars: entries.map(([color, count]) => ({
        color,
        count,
        colorClass: COLOR_MAP[color] || 'bg-muted',
      })) as DashboardColorBar[],
    };
  }, [allGarments]);

  return {
    dashboard: dashboardQuery.data ?? null,
    overview: dashboardQuery.data?.overview ?? null,
    behavior: dashboardQuery.data?.behavior ?? null,
    wardrobeHealth: dashboardQuery.data?.wardrobeHealth ?? null,
    insights,
    dna,
    sustainability,
    isPremium: subscription.isPremium,
    isLoading: dashboardQuery.isLoading || subscription.isLoading,
    isRefreshing: dashboardQuery.isFetching,
    allGarments,
    colorBreakdown,
  };
}
