import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TravelCapsuleRow, CapsuleResult } from '@/components/travel/types';

const MAX_CAPSULES = 10;

export function useTravelCapsules() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['travel-capsules', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('travel_capsules')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_CAPSULES);
      if (error) throw error;
      return (data ?? []).filter(
        (row): row is TravelCapsuleRow =>
          row.result != null &&
          typeof row.result === 'object' &&
          Array.isArray((row.result as Record<string, unknown>).outfits)
      ) as TravelCapsuleRow[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (capsule: {
      destination: string;
      trip_type: string;
      duration_days: number;
      weather_min: number | null;
      weather_max: number | null;
      start_date: string | null;
      end_date: string | null;
      occasions: string[];
      luggage_type: string;
      companions: string;
      style_preference: string;
      capsule_items: unknown;
      outfits: unknown;
      packing_list: unknown;
      packing_tips: string[] | null;
      total_combinations: number;
      reasoning: string | null;
      result: CapsuleResult;
    }) => {
      if (!user) throw new Error('Not authenticated');
      // Fresh count to avoid stale query.data race
      const { count, error: countErr } = await supabase
        .from('travel_capsules')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (!countErr && count !== null && count >= MAX_CAPSULES) {
        // Delete the oldest
        const { data: oldest } = await supabase
          .from('travel_capsules')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        if (oldest) {
          await supabase.from('travel_capsules').delete().eq('id', oldest.id);
        }
      }
      const { data, error } = await supabase
        .from('travel_capsules')
        .insert({ user_id: user.id, ...capsule })
        .select()
        .single();
      if (error) throw error;
      return data as TravelCapsuleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-capsules', user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('travel_capsules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-capsules', user?.id] });
    },
  });

  return {
    capsules: query.data ?? [],
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    remove: deleteMutation.mutateAsync,
  };
}
