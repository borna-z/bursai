import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Garment } from './useGarments';

export interface SwapCandidate {
  garment: Garment;
  score: number;
  breakdown?: Record<string, number>;
}

export function useSwapGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  const fetchCandidates = async (
    slot: string,
    currentGarmentId: string,
    otherGarmentColors: string[],
    otherItems?: { slot: string; garment_id: string }[],
    occasion?: string,
    weather?: { temperature?: number; precipitation?: string; wind?: string }
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];

    setIsLoadingCandidates(true);
    try {
      // Use the BURS style engine for smart swap scoring
      const { data, error } = await supabase.functions.invoke('burs_style_engine', {
        body: {
          mode: 'swap',
          swap_slot: slot,
          current_garment_id: currentGarmentId,
          other_items: otherItems || [],
          occasion: occasion || 'vardag',
          weather: weather || { precipitation: 'none', wind: 'low' },
        },
      });

      if (error || data?.error) {
        console.error('Swap engine error, falling back to basic scoring:', error || data?.error);
        return await fallbackFetchCandidates(slot, currentGarmentId, otherGarmentColors);
      }

      const scored: SwapCandidate[] = (data.candidates || []).map((c: any) => ({
        garment: c.garment as Garment,
        score: c.score,
        breakdown: c.breakdown,
      }));

      setCandidates(scored);
      return scored;
    } catch (err) {
      console.error('Swap fetch failed:', err);
      return await fallbackFetchCandidates(slot, currentGarmentId, otherGarmentColors);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  // Fallback: basic client-side scoring if engine fails
  const fallbackFetchCandidates = async (
    slot: string,
    currentGarmentId: string,
    otherGarmentColors: string[]
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];

    const SLOT_CATEGORIES: Record<string, string[]> = {
      top: ['top'], bottom: ['bottom'], shoes: ['shoes'],
      outerwear: ['outerwear'], accessory: ['accessory'],
    };
    const categories = SLOT_CATEGORIES[slot] || [slot];

    const { data: garments, error } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', user.id)
      .eq('in_laundry', false)
      .in('category', categories)
      .neq('id', currentGarmentId);

    if (error || !garments) return [];

    const scored = garments.map(garment => ({
      garment,
      score: 5 + (garment.wear_count === 0 ? 2 : garment.wear_count < 5 ? 1 : 0),
    }));

    scored.sort((a, b) => b.score - a.score);
    setCandidates(scored);
    return scored;
  };

  const swapMutation = useMutation({
    mutationFn: async ({ outfitItemId, newGarmentId }: { outfitItemId: string; newGarmentId: string }) => {
      const { data, error } = await supabase
        .from('outfit_items')
        .update({ garment_id: newGarmentId })
        .eq('id', outfitItemId)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Swap failed — no row was updated.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfit'] });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      setCandidates([]);
    },
  });

  return {
    candidates,
    isLoadingCandidates,
    fetchCandidates,
    swapGarment: swapMutation.mutateAsync,
    isSwapping: swapMutation.isPending,
    clearCandidates: () => setCandidates([]),
  };
}
