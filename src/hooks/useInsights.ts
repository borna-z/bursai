import { useMemo } from 'react';
import {
  type ColorTemperatureData,
  type Garment,
  type InsightsData,
  toInsightsData,
  useInsightsDashboard,
} from '@/hooks/useInsightsDashboard';

export type { ColorTemperatureData, Garment, InsightsData };

export function useInsights() {
  const query = useInsightsDashboard();
  const data = useMemo(() => toInsightsData(query.data ?? null), [query.data]);
  return { ...query, data };
}
