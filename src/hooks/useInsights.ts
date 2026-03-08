import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export interface ColorTemperatureData {
  temperature: number;       // -1 (cool) to +1 (warm)
  warmCount: number;
  coolCount: number;
  neutralCount: number;
  totalChromatic: number;
  dominantPalette: 'warm' | 'cool' | 'neutral' | 'balanced';
}

export interface InsightsData {
  totalGarments: number;
  garmentsUsedLast30Days: number;
  usageRate: number;
  topFiveWorn: (Garment & { wearCountLast30: number })[];
  unusedGarments: Garment[];
  colorTemperature: ColorTemperatureData;
}

export function useInsights() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['insights', user?.id],
    queryFn: async (): Promise<InsightsData | null> => {
      if (!user) return null;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      
      // Get all garments
      const { data: garments, error: garmentsError } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id);
      
      if (garmentsError) throw garmentsError;
      
      // Get wear logs from last 30 days
      const { data: wearLogs, error: logsError } = await supabase
        .from('wear_logs')
        .select('garment_id, worn_at')
        .eq('user_id', user.id)
        .gte('worn_at', thirtyDaysAgoStr);
      
      if (logsError) throw logsError;
      
      const totalGarments = garments?.length || 0;
      
      // Count wear per garment in last 30 days
      const wearCountMap: Record<string, number> = {};
      wearLogs?.forEach(log => {
        wearCountMap[log.garment_id] = (wearCountMap[log.garment_id] || 0) + 1;
      });
      
      const wornGarmentIds = new Set(Object.keys(wearCountMap));
      const garmentsUsedLast30Days = wornGarmentIds.size;
      const usageRate = totalGarments > 0 ? Math.round((garmentsUsedLast30Days / totalGarments) * 100) : 0;
      
      // Top 5 most worn garments (by wear count in last 30 days)
      const topFiveWorn = garments
        ?.filter(g => wearCountMap[g.id])
        .map(g => ({ ...g, wearCountLast30: wearCountMap[g.id] || 0 }))
        .sort((a, b) => b.wearCountLast30 - a.wearCountLast30)
        .slice(0, 5) || [];
      
      // Unused garments (not worn in last 30 days)
      const unusedGarments = garments?.filter(g => !wornGarmentIds.has(g.id)) || [];
      
      // Color temperature profiling
      const colorTemperature = computeColorTemperature(garments || []);
      
      return {
        totalGarments,
        garmentsUsedLast30Days,
        usageRate,
        topFiveWorn,
        unusedGarments,
        colorTemperature,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
