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
      const { data, error } = await invokeEdgeFunction<{ candidates?: SwapCandidate[]; error?: string }>('burs_style_engine', {
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

      const scored: SwapCandidate[] = (data?.candidates || []).map((c) => ({
        garment: c.garment,
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

  // Fallback: improved client-side scoring if engine fails
  const fallbackFetchCandidates = async (
    slot: string,
    currentGarmentId: string,
    otherGarmentColors: string[]
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];

    const SLOT_CATEGORIES: Record<string, string[]> = {
      top: ['top'], bottom: ['bottom'], shoes: ['shoes'],
      outerwear: ['outerwear'], accessory: ['accessory'],
      dress: ['dress'],
    };
    const categories = SLOT_CATEGORIES[slot] || [slot];

    const { data: garments, error } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', user.id)
      .in('category', categories)
      .neq('id', currentGarmentId);

    if (error || !garments) return [];

    // Neutral colors that pair well with anything
    const NEUTRALS = new Set(['black', 'white', 'grey', 'gray', 'navy', 'beige', 'cream', 'charcoal', 'brown', 'tan', 'khaki']);

    // Simple color families for rough harmony
    const colorFamily = (c: string): string => {
      const cl = (c || '').toLowerCase();
      if (NEUTRALS.has(cl)) return 'neutral';
      if (['red', 'burgundy', 'maroon', 'wine', 'crimson'].some(k => cl.includes(k))) return 'red';
      if (['blue', 'cobalt', 'indigo', 'teal', 'cyan'].some(k => cl.includes(k))) return 'blue';
      if (['green', 'olive', 'sage', 'emerald', 'mint'].some(k => cl.includes(k))) return 'green';
      if (['pink', 'rose', 'blush', 'coral'].some(k => cl.includes(k))) return 'pink';
      if (['yellow', 'gold', 'mustard'].some(k => cl.includes(k))) return 'yellow';
      if (['orange', 'rust', 'terracotta'].some(k => cl.includes(k))) return 'orange';
      if (['purple', 'violet', 'plum', 'lavender'].some(k => cl.includes(k))) return 'purple';
      return 'other';
    };

    const otherFamilies = otherGarmentColors.map(c => colorFamily(c));
    const otherNeutralCount = otherFamilies.filter(f => f === 'neutral').length;

    const scored: SwapCandidate[] = garments
      .filter(g => !g.in_laundry)
      .map(garment => {
        let score = 5;

        // 1. Wear freshness: favor unworn / less-worn items
        const wc = garment.wear_count ?? 0;
        if (wc === 0) score += 2;
        else if (wc < 3) score += 1.5;
        else if (wc < 8) score += 0.5;
        else score -= 0.5;

        // Recency: boost items not worn recently
        if (garment.last_worn_at) {
          const daysSince = (Date.now() - new Date(garment.last_worn_at).getTime()) / 86400000;
          if (daysSince > 30) score += 1;
          else if (daysSince > 14) score += 0.5;
          else if (daysSince < 3) score -= 1;
        } else {
          score += 0.5; // never worn = fresh
        }

        // 2. Color compatibility
        const cFamily = colorFamily(garment.color_primary);
        if (cFamily === 'neutral') {
          // Neutrals are always safe; slight penalty if outfit is already all neutrals
          score += otherNeutralCount < otherFamilies.length ? 1.5 : 0.5;
        } else {
          // Non-neutral: check clashing vs complementary
          const clashCount = otherFamilies.filter(f => f !== 'neutral' && f !== cFamily).length;
          if (clashCount === 0) score += 1; // harmonious
          else if (clashCount === 1) score += 0.5; // one accent is fine
          else score -= clashCount * 0.5; // too many competing colors
        }

        // 3. Formality alignment: prefer mid-range, penalize extremes
        const formality = garment.formality;
        if (typeof formality === 'number') {
          if (formality >= 3 && formality <= 7) score += 0.5; // versatile range
          else if (formality > 8 || formality < 2) score -= 0.5; // extreme
        }

        // 4. Fit preference: slight boost for regular/versatile fits
        const fit = (garment.fit || '').toLowerCase();
        if (['regular', 'straight'].some(f => fit.includes(f))) score += 0.3;

        return { garment, score: Math.max(0, Math.min(10, score)) };
      });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 10);
    setCandidates(top);
    return top;
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
