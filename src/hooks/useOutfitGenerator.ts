import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Garment } from './useGarments';

export interface OutfitRequest {
  occasion: string;
  style?: string | null;
  weather: {
    temperature?: number;
    precipitation: string;
    wind: string;
  };
}

export interface GeneratedOutfit {
  id: string;
  occasion: string;
  style_vibe: string | null;
  explanation: string;
  weather: OutfitRequest['weather'];
  items: {
    slot: string;
    garment: Garment;
  }[];
}

// Slot categories mapping
const SLOT_CATEGORIES: Record<string, string[]> = {
  top: ['top'],
  bottom: ['bottom'],
  shoes: ['shoes'],
  outerwear: ['outerwear'],
  accessory: ['accessory'],
};

// Occasion formality targets (1-5)
const OCCASION_FORMALITY: Record<string, { min: number; max: number }> = {
  vardag: { min: 2, max: 3 },
  jobb: { min: 3, max: 4 },
  fest: { min: 4, max: 5 },
  dejt: { min: 3, max: 4 },
  traning: { min: 1, max: 2 },
  resa: { min: 2, max: 3 },
};

// Neutral colors that go with everything
const NEUTRAL_COLORS = ['svart', 'vit', 'grå', 'beige', 'marin', 'marinblå'];

// Strong colors that can clash
const STRONG_COLORS = ['röd', 'rosa', 'lila', 'gul', 'orange', 'grön', 'blå'];

// Season mapping based on temperature
function getSeasonFromTemp(temp?: number): string[] {
  if (temp === undefined) return ['Året runt'];
  if (temp <= 5) return ['Vinter', 'Året runt'];
  if (temp <= 14) return ['Vår/Höst', 'Året runt'];
  return ['Sommar', 'Året runt'];
}

// Check if outerwear is needed
function needsOuterwear(weather: OutfitRequest['weather']): boolean {
  const temp = weather.temperature;
  if (temp !== undefined && temp <= 10) return true;
  if (weather.precipitation !== 'none') return true;
  return false;
}

// Calculate formality score match
function formalityScore(garment: Garment, occasion: string): number {
  const target = OCCASION_FORMALITY[occasion] || { min: 2, max: 4 };
  const formality = garment.formality || 3;
  
  if (formality >= target.min && formality <= target.max) {
    return 10; // Perfect match
  }
  
  const distance = Math.min(
    Math.abs(formality - target.min),
    Math.abs(formality - target.max)
  );
  
  return Math.max(0, 10 - distance * 3);
}

// Calculate season match score
function seasonScore(garment: Garment, weather: OutfitRequest['weather']): number {
  const seasons = getSeasonFromTemp(weather.temperature);
  const garmentSeasons = garment.season_tags || ['Året runt'];
  
  const hasMatch = seasons.some(s => garmentSeasons.includes(s));
  return hasMatch ? 10 : 0;
}

// Check if two colors clash
function colorsClash(color1: string, color2: string): boolean {
  const c1 = color1.toLowerCase();
  const c2 = color2.toLowerCase();
  
  // Both neutral = no clash
  if (NEUTRAL_COLORS.includes(c1) && NEUTRAL_COLORS.includes(c2)) {
    return false;
  }
  
  // One neutral = no clash
  if (NEUTRAL_COLORS.includes(c1) || NEUTRAL_COLORS.includes(c2)) {
    return false;
  }
  
  // Both strong and different = potential clash
  if (STRONG_COLORS.includes(c1) && STRONG_COLORS.includes(c2) && c1 !== c2) {
    return true;
  }
  
  return false;
}

// Score garment based on color harmony with existing items
function colorHarmonyScore(garment: Garment, selectedItems: Garment[]): number {
  const color = garment.color_primary?.toLowerCase() || '';
  
  for (const item of selectedItems) {
    const itemColor = item.color_primary?.toLowerCase() || '';
    if (colorsClash(color, itemColor)) {
      return 0;
    }
  }
  
  // Bonus for neutrals
  if (NEUTRAL_COLORS.includes(color)) {
    return 8;
  }
  
  return 5;
}

// Score based on wear history (prefer less worn items)
function wearScore(garment: Garment): number {
  const wearCount = garment.wear_count || 0;
  const lastWorn = garment.last_worn_at;
  
  let score = 5;
  
  // Less worn = higher score
  if (wearCount === 0) score += 3;
  else if (wearCount < 3) score += 2;
  else if (wearCount < 10) score += 1;
  
  // Not worn recently = bonus
  if (lastWorn) {
    const daysSince = Math.floor((Date.now() - new Date(lastWorn).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) score += 2;
    else if (daysSince > 7) score += 1;
  } else {
    score += 2; // Never worn
  }
  
  return score;
}

// Select best garment for a slot
function selectGarmentForSlot(
  slot: string,
  garments: Garment[],
  request: OutfitRequest,
  selectedItems: Garment[]
): Garment | null {
  const categories = SLOT_CATEGORIES[slot];
  if (!categories) return null;
  
  // Filter by category
  const candidates = garments.filter(g => categories.includes(g.category));
  
  if (candidates.length === 0) return null;
  
  // Score each candidate
  const scored = candidates.map(g => {
    const formality = formalityScore(g, request.occasion);
    const season = seasonScore(g, request.weather);
    const harmony = colorHarmonyScore(g, selectedItems);
    const wear = wearScore(g);
    
    // Weighted total
    const total = (formality * 2) + (season * 2) + harmony + wear;
    
    return { garment: g, score: total };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  // Add some randomness among top candidates
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  const randomIndex = Math.floor(Math.random() * topCandidates.length);
  
  return topCandidates[randomIndex]?.garment || null;
}

// Generate explanation text
function generateExplanation(
  items: { slot: string; garment: Garment }[],
  request: OutfitRequest
): string {
  const parts: string[] = [];
  
  // Occasion context
  const occasionLabels: Record<string, string> = {
    vardag: 'vardagen',
    jobb: 'jobbet',
    fest: 'festen',
    dejt: 'dejten',
    traning: 'träningen',
    resa: 'resan',
  };
  
  const occasion = occasionLabels[request.occasion] || request.occasion;
  parts.push(`Perfekt för ${occasion}`);
  
  // Weather context
  if (request.weather.temperature !== undefined) {
    const temp = request.weather.temperature;
    if (temp <= 5) parts.push('med lager för kylan');
    else if (temp >= 20) parts.push('luftigt för värmen');
  }
  
  // Color harmony
  const colors = items.map(i => i.garment.color_primary).filter(Boolean);
  const uniqueColors = [...new Set(colors)];
  if (uniqueColors.length <= 3) {
    parts.push('med harmoniska färger');
  }
  
  // Style match
  if (request.style) {
    const styleLabels: Record<string, string> = {
      minimal: 'minimalistisk stil',
      street: 'street-känsla',
      'smart-casual': 'smart casual-look',
      klassisk: 'klassisk elegans',
    };
    if (styleLabels[request.style]) {
      parts.push(`i ${styleLabels[request.style]}`);
    }
  }
  
  return parts.slice(0, 3).join(' ') + '.';
}

// Main outfit generation function
async function generateOutfit(
  userId: string,
  request: OutfitRequest
): Promise<GeneratedOutfit> {
  // Fetch available garments (exclude in_laundry)
  const { data: garments, error } = await supabase
    .from('garments')
    .select('*')
    .eq('user_id', userId)
    .eq('in_laundry', false);
  
  if (error) throw error;
  if (!garments || garments.length === 0) {
    throw new Error('Inga plagg tillgängliga');
  }
  
  const selectedItems: { slot: string; garment: Garment }[] = [];
  const usedGarments: Garment[] = [];
  
  // Required slots
  const requiredSlots = ['top', 'bottom', 'shoes'];
  
  // Optional slots based on conditions
  const optionalSlots: string[] = [];
  if (needsOuterwear(request.weather)) {
    optionalSlots.push('outerwear');
  }
  optionalSlots.push('accessory');
  
  // Select garments for required slots
  for (const slot of requiredSlots) {
    const garment = selectGarmentForSlot(slot, garments, request, usedGarments);
    if (garment) {
      selectedItems.push({ slot, garment });
      usedGarments.push(garment);
    }
  }
  
  // Check if we have minimum required items
  if (selectedItems.length < 2) {
    throw new Error('Inte tillräckligt med plagg för att skapa outfit');
  }
  
  // Select garments for optional slots
  for (const slot of optionalSlots) {
    const garment = selectGarmentForSlot(slot, garments, request, usedGarments);
    if (garment) {
      selectedItems.push({ slot, garment });
      usedGarments.push(garment);
    }
  }
  
  // Generate explanation
  const explanation = generateExplanation(selectedItems, request);
  
  // Save outfit to database
  const weatherJson = {
    temperature: request.weather.temperature,
    precipitation: request.weather.precipitation,
    wind: request.weather.wind,
  };
  
  const outfitInsert: {
    user_id: string;
    occasion: string;
    style_vibe: string | null;
    weather: typeof weatherJson;
    explanation: string;
    saved: boolean;
  } = {
    user_id: userId,
    occasion: request.occasion,
    style_vibe: request.style || null,
    weather: weatherJson,
    explanation,
    saved: true,
  };
  
  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert([outfitInsert])
    .select()
    .single();
  
  if (outfitError) throw outfitError;
  
  // Save outfit items
  const outfitItems = selectedItems.map(item => ({
    outfit_id: outfit.id,
    garment_id: item.garment.id,
    slot: item.slot,
  }));
  
  const { error: itemsError } = await supabase
    .from('outfit_items')
    .insert(outfitItems);
  
  if (itemsError) throw itemsError;
  
  return {
    id: outfit.id,
    occasion: outfit.occasion,
    style_vibe: outfit.style_vibe,
    explanation,
    weather: request.weather,
    items: selectedItems,
  };
}

export function useOutfitGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const mutation = useMutation({
    mutationFn: async (request: OutfitRequest) => {
      if (!user) throw new Error('Inte inloggad');
      setIsGenerating(true);
      try {
        return await generateOutfit(user.id, request);
      } finally {
        setIsGenerating(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
    },
  });
  
  return {
    generateOutfit: mutation.mutateAsync,
    isGenerating: isGenerating || mutation.isPending,
    error: mutation.error,
  };
}
