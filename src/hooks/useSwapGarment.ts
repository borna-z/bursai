import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { useAuth } from '@/contexts/AuthContext';
import type { Garment } from './useGarments';

export interface SwapCandidate {
  garment: Garment;
  score: number;
  breakdown?: Record<string, number>;
  swap_reason?: string | null;
}

export type SwapMode = 'safe' | 'bold' | 'fresh';

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
    weather?: { temperature?: number; precipitation?: string; wind?: string },
    swapMode: SwapMode = 'safe'
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];

    setIsLoadingCandidates(true);
    try {
      const { data, error } = await invokeEdgeFunction<{ candidates?: SwapCandidate[]; error?: string }>(
        'burs_style_engine',
        {
          body: {
            mode: 'swap',
            swap_slot: slot,
            current_garment_id: currentGarmentId,
            other_items: otherItems || [],
            occasion: occasion || 'vardag',
            weather: weather || { precipitation: 'none', wind: 'low' },
            swap_mode: swapMode,
          },
        }
      );

      if (error || data?.error) {
        console.error('Swap engine error, falling back to basic scoring:', error || data?.error);
        return await fallbackFetchCandidates(slot, currentGarmentId, otherGarmentColors, swapMode);
      }

      const scored: SwapCandidate[] = (data?.candidates || []).map((c) => ({
        garment: c.garment,
        score: c.score,
        breakdown: c.breakdown,
        swap_reason: c.swap_reason || null,
      }));

      setCandidates(scored);
      return scored;
    } catch (err) {
      console.error('Swap fetch failed:', err);
      return await fallbackFetchCandidates(slot, currentGarmentId, otherGarmentColors, swapMode);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const fallbackFetchCandidates = async (
    slot: string,
    currentGarmentId: string,
    otherGarmentColors: string[],
    swapMode: SwapMode = 'safe'
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];

    const SLOT_CATEGORIES: Record<string, string[]> = {
      top: ['top'],
      bottom: ['bottom'],
      shoes: ['shoes'],
      outerwear: ['outerwear'],
      accessory: ['accessory'],
      dress: ['dress'],
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

    const neutralWords = ['black', 'white', 'grey', 'gray', 'navy', 'beige', 'brown', 'cream'];

    const colorFit = (color?: string | null) => {
      const c = String(color || '').toLowerCase();
      if (!c) return 5.5;
      if (otherGarmentColors.some((x) => x === c)) return 7.5;
      if (neutralWords.some((x) => c.includes(x))) return 7;
      return 5.8;
    };

    const freshness = (wearCount?: number | null) => {
      if (wearCount == null) return 6;
      if (wearCount === 0) return 8.6;
      if (wearCount < 5) return 7.3;
      if (wearCount < 15) return 6.4;
      return 5.5;
    };

    const expressiveLift = (garment: Garment) => {
      const color = String(garment.color_primary || '').toLowerCase();
      const pattern = String(garment.pattern || 'solid').toLowerCase();
      const material = String(garment.material || '').toLowerCase();

      let score = 5.5;
      if (!neutralWords.some((x) => color.includes(x))) score += 1.2;
      if (pattern !== 'solid' && pattern !== 'none') score += 1.2;
      if (['leather', 'wool', 'silk', 'satin'].some((x) => material.includes(x))) score += 0.6;

      return Math.max(0, Math.min(10, score));
    };

    const scored = garments.map((garment) => {
      const f = freshness(garment.wear_count);
      const c = colorFit(garment.color_primary);
      const e = expressiveLift(garment);

      let score = 0;

      if (swapMode === 'safe') {
        score = f * 0.30 + c * 0.55 + e * 0.15;
      } else if (swapMode === 'bold') {
        score = f * 0.20 + c * 0.30 + e * 0.50;
      } else {
        score = f * 0.50 + c * 0.30 + e * 0.20;
      }

      return {
        garment,
        score,
        breakdown: {
          overall: score,
          freshness: f,
          color_fit: c,
          expressive_lift: e,
          swap_mode: swapMode === 'safe' ? 1 : swapMode === 'bold' ? 2 : 3,
        },
      };
    });

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
