import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

export function useInsights() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['insights', user?.id],
    queryFn: async () => {
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
        .select('garment_id')
        .eq('user_id', user.id)
        .gte('worn_at', thirtyDaysAgoStr);
      
      if (logsError) throw logsError;
      
      const totalGarments = garments?.length || 0;
      const wornGarmentIds = new Set(wearLogs?.map(log => log.garment_id) || []);
      const wornCount = wornGarmentIds.size;
      const usageRate = totalGarments > 0 ? Math.round((wornCount / totalGarments) * 100) : 0;
      
      // Most worn garments
      const wearCountMap: Record<string, number> = {};
      wearLogs?.forEach(log => {
        wearCountMap[log.garment_id] = (wearCountMap[log.garment_id] || 0) + 1;
      });
      
      const mostWorn = garments
        ?.filter(g => wearCountMap[g.id])
        .sort((a, b) => (wearCountMap[b.id] || 0) - (wearCountMap[a.id] || 0))
        .slice(0, 5) || [];
      
      // Unused garments (not worn in last 30 days)
      const unusedGarments = garments?.filter(g => !wornGarmentIds.has(g.id)) || [];
      
      return {
        totalGarments,
        usageRate,
        mostWorn: mostWorn as Garment[],
        unusedGarments: unusedGarments as Garment[],
      };
    },
    enabled: !!user,
  });
}
