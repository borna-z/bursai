import { useMemo } from 'react';
import {
  type StyleDNA,
  type StyleDNAPattern,
  toStyleDna,
  useInsightsDashboard,
} from '@/hooks/useInsightsDashboard';

export type { StyleDNA, StyleDNAPattern };

export function useStyleDNA() {
  const query = useInsightsDashboard();
  const data = useMemo(() => toStyleDna(query.data ?? null), [query.data]);
  return { ...query, data };
}
