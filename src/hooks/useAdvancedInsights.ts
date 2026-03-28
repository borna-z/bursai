import { useMemo } from 'react';
import { useInsightsDashboard } from '@/hooks/useInsightsDashboard';

export interface SpendingData {
  totalValue: number;
  currency: string;
  categoryBreakdown: { category: string; total: number; count: number }[];
  topCostPerWear: { id: string; title: string | null; image_path: string | null; cpw: number; wears: number; price: number }[];
  worstCostPerWear: { id: string; title: string | null; image_path: string | null; cpw: number; wears: number; price: number }[];
}

export function useSpendingData(_locale?: string) {
  const query = useInsightsDashboard();
  const data = useMemo<SpendingData | null>(() => query.data?.value.spending ?? null, [query.data]);
  return { ...query, data };
}

export interface OutfitRepeatData {
  repeats: { id: string; occasion: string; wornCount: number; lastWorn: string; daysSince: number }[];
  staleOutfits: { id: string; occasion: string; daysSince: number }[];
}

export function useOutfitRepeats() {
  const query = useInsightsDashboard();
  const data = useMemo<OutfitRepeatData | null>(() => {
    if (!query.data) return null;
    return {
      repeats: query.data.behavior.repeats,
      staleOutfits: query.data.behavior.staleOutfits,
    };
  }, [query.data]);
  return { ...query, data };
}

export interface WearHeatmapData {
  days: { date: string; status: 'planned' | 'improvised' | 'none' }[];
  streak: number;
  consistency: number;
}

export function useWearHeatmap() {
  const query = useInsightsDashboard();
  const data = useMemo<WearHeatmapData | null>(() => {
    if (!query.data) return null;
    return {
      days: query.data.behavior.heatmapDays,
      streak: query.data.behavior.streak,
      consistency: query.data.behavior.consistency,
    };
  }, [query.data]);
  return { ...query, data };
}

export interface CategoryBalanceData {
  categories: { name: string; count: number; percentage: number }[];
  total: number;
}

export function useCategoryBalance() {
  const query = useInsightsDashboard();
  const data = useMemo<CategoryBalanceData | null>(() => {
    if (!query.data) return null;
    return {
      categories: query.data.wardrobeHealth.categoryBalance,
      total: query.data.overview.totalGarments,
    };
  }, [query.data]);
  return { ...query, data };
}
