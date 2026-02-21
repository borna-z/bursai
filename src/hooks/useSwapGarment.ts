import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Garment } from './useGarments';

// Slot categories mapping
const SLOT_CATEGORIES: Record<string, string[]> = {
  top: ['top'],
  bottom: ['bottom'],
  shoes: ['shoes'],
  outerwear: ['outerwear'],
  accessory: ['accessory'],
};

// Neutral colors that go with everything
const NEUTRAL_COLORS = ['svart', 'vit', 'grå', 'beige', 'marin', 'marinblå'];

// Strong colors that can clash
const STRONG_COLORS = ['röd', 'rosa', 'lila', 'gul', 'orange', 'grön', 'blå'];

// Check if two colors clash
function colorsClash(color1: string, color2: string): boolean {
  const c1 = color1.toLowerCase();
  const c2 = color2.toLowerCase();
  
  if (NEUTRAL_COLORS.includes(c1) && NEUTRAL_COLORS.includes(c2)) return false;
  if (NEUTRAL_COLORS.includes(c1) || NEUTRAL_COLORS.includes(c2)) return false;
  if (STRONG_COLORS.includes(c1) && STRONG_COLORS.includes(c2) && c1 !== c2) return true;
  
  return false;
}

export interface SwapCandidate {
  garment: Garment;
  score: number;
}

export function useSwapGarment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [candidates, setCandidates] = useState<SwapCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  
  // Fetch swap candidates for a slot
  const fetchCandidates = async (
    slot: string, 
    currentGarmentId: string,
    otherGarmentColors: string[]
  ): Promise<SwapCandidate[]> => {
    if (!user) return [];
    
    setIsLoadingCandidates(true);
    try {
      const categories = SLOT_CATEGORIES[slot] || [slot];
      
      // Fetch available garments for this slot
      const { data: garments, error } = await supabase
        .from('garments')
        .select('*')
        .eq('user_id', user.id)
        .eq('in_laundry', false)
        .in('category', categories)
        .neq('id', currentGarmentId);
      
      if (error) throw error;
      if (!garments) return [];
      
      // Score each garment
      const scored = garments.map(garment => {
        let score = 5;
        
        // Color harmony with other items
        const color = garment.color_primary?.toLowerCase() || '';
        const hasClash = otherGarmentColors.some(c => colorsClash(color, c));
        if (hasClash) {
          score -= 3;
        } else if (NEUTRAL_COLORS.includes(color)) {
          score += 2;
        }
        
        // Prefer less worn items
        const wearCount = garment.wear_count || 0;
        if (wearCount === 0) score += 2;
        else if (wearCount < 5) score += 1;
        
        // Prefer items not worn recently
        if (garment.last_worn_at) {
          const daysSince = Math.floor(
            (Date.now() - new Date(garment.last_worn_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSince > 14) score += 1;
        } else {
          score += 1;
        }
        
        return { garment, score };
      });
      
      // Sort by score
      scored.sort((a, b) => b.score - a.score);
      
      setCandidates(scored);
      return scored;
    } finally {
      setIsLoadingCandidates(false);
    }
  };
  
  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async ({ 
      outfitItemId, 
      newGarmentId 
    }: { 
      outfitItemId: string; 
      newGarmentId: string;
    }) => {
      const { data, error } = await supabase
        .from('outfit_items')
        .update({ garment_id: newGarmentId })
        .eq('id', outfitItemId)
        .select('id');
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Swap failed — no row was updated. Please try again.');
      }
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
