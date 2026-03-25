import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';

// Step 18: Condition tracking
export function useAssessCondition() {
  return useMutation({
    mutationFn: async (garmentId: string) => {
      const { data, error } = await invokeEdgeFunction<{ condition_score: number; notes: string; should_replace: boolean; error?: string }>('assess_garment_condition', {
        body: { garment_id: garmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data!;
    },
  });
}

// Step 19: Outfit DNA cloning
export function useCloneOutfitDNA() {
  return useMutation({
    mutationFn: async (outfitId: string) => {
      const { data, error } = await invokeEdgeFunction<{ variations: Array<{ name: string; garment_ids: string[]; explanation: string }>; error?: string }>('clone_outfit_dna', {
        body: { outfit_id: outfitId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data!;
    },
  });
}

// Step 20: Smart accessory pairing
export function useSuggestAccessories() {
  return useMutation({
    mutationFn: async (outfitId: string) => {
      const { data, error } = await invokeEdgeFunction<{ suggestions: Array<{ garment_id: string; reason: string }>; error?: string }>('suggest_accessories', {
        body: { outfit_id: outfitId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data!;
    },
  });
}

// Step 21: Wardrobe gap analysis
export function useWardrobeGapAnalysis() {
  return useMutation({
    mutationFn: async (params?: { locale?: string }) => {
      const { data, error } = await invokeEdgeFunction<{ gaps: Array<{ item: string; category: string; color: string; reason: string; new_outfits: number; price_range: string; search_query: string }>; error?: string }>('wardrobe_gap_analysis', {
        body: { locale: params?.locale || 'en' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data!;
    },
  });
}

// Step 22: Cost-per-wear (client-side calculation)
export function useCostPerWear(purchasePrice: number | null, wearCount: number | null) {
  if (!purchasePrice || !wearCount || wearCount === 0) return null;
  return Math.round((purchasePrice / wearCount) * 100) / 100;
}

// Step 23: Sustainability score (client-side calculation)
export function useSustainabilityScore() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sustainability', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: garments } = await supabase
        .from('garments')
        .select('id, wear_count, last_worn_at, created_at')
        .eq('user_id', user.id);

      const { data: wearLogs } = await supabase
        .from('wear_logs')
        .select('garment_id, worn_at')
        .eq('user_id', user.id)
        .gte('worn_at', thirtyDaysAgo.toISOString().split('T')[0]);

      if (!garments || garments.length === 0) return null;

      const total = garments.length;
      const wornIds = new Set(wearLogs?.map(l => l.garment_id) || []);
      const usedCount = wornIds.size;
      const utilizationRate = Math.round((usedCount / total) * 100);

      // Rewear rate: avg wear_count across all garments
      const avgWearCount = garments.reduce((sum, g) => sum + (g.wear_count || 0), 0) / total;

      // Underused items (not worn in 60+ days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const underused = garments.filter(g => {
        if (!g.last_worn_at) return true;
        return new Date(g.last_worn_at) < sixtyDaysAgo;
      }).length;

      // Score: 0-100 (higher is more sustainable)
      const utilizationScore = Math.min(utilizationRate, 100);
      const rewearScore = Math.min(avgWearCount * 10, 100);
      const underuseScore = Math.max(0, 100 - (underused / total) * 100);
      const sustainabilityScore = Math.round((utilizationScore * 0.4 + rewearScore * 0.3 + underuseScore * 0.3));

      return {
        score: sustainabilityScore,
        utilizationRate,
        avgWearCount: Math.round(avgWearCount * 10) / 10,
        underusedCount: underused,
        totalGarments: total,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

// Step 24: Style evolution (client-side from wear_logs)
export function useStyleEvolution() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['style-evolution', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: wearLogs } = await supabase
        .from('wear_logs')
        .select('garment_id, worn_at')
        .eq('user_id', user.id)
        .gte('worn_at', sixMonthsAgo.toISOString().split('T')[0])
        .order('worn_at', { ascending: true });

      const { data: garments } = await supabase
        .from('garments')
        .select('id, color_primary, category, formality')
        .eq('user_id', user.id);

      if (!wearLogs || !garments || wearLogs.length === 0) return null;

      const garmentMap = new Map(garments.map(g => [g.id, g]));

      // Group by month
      const months: Record<string, { colors: Record<string, number>; categories: Record<string, number>; formalitySum: number; count: number }> = {};

      for (const log of wearLogs) {
        const month = log.worn_at.substring(0, 7); // YYYY-MM
        if (!months[month]) months[month] = { colors: {}, categories: {}, formalitySum: 0, count: 0 };
        const g = garmentMap.get(log.garment_id);
        if (!g) continue;

        months[month].colors[g.color_primary] = (months[month].colors[g.color_primary] || 0) + 1;
        months[month].categories[g.category] = (months[month].categories[g.category] || 0) + 1;
        months[month].formalitySum += g.formality || 3;
        months[month].count++;
      }

      const timeline = Object.entries(months)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          topColor: Object.entries(data.colors).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
          topCategory: Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown',
          avgFormality: Math.round((data.formalitySum / data.count) * 10) / 10,
          outfitCount: data.count,
        }));

      return { timeline };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}
