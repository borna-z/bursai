import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Garment = Tables<'garments'>;

// ── Color Temperature Logic (mirrors style engine) ──

const COLOR_HSL: Record<string, [number, number, number]> = {
  svart: [0, 0, 5], black: [0, 0, 5],
  vit: [0, 0, 97], white: [0, 0, 97],
  grå: [0, 0, 50], grey: [0, 0, 50], gray: [0, 0, 50],
  beige: [40, 30, 80],
  marin: [220, 60, 20], marinblå: [220, 60, 20], navy: [220, 60, 20],
  brun: [25, 50, 30], brown: [25, 50, 30],
  blå: [220, 70, 50], blue: [220, 70, 50],
  röd: [0, 80, 45], red: [0, 80, 45],
  rosa: [330, 60, 70], pink: [330, 60, 70],
  grön: [130, 60, 40], green: [130, 60, 40],
  gul: [50, 80, 55], yellow: [50, 80, 55],
  orange: [25, 85, 55],
  lila: [270, 60, 50], purple: [270, 60, 50],
  vinröd: [345, 60, 30], burgundy: [345, 60, 30],
  khaki: [55, 30, 55],
  kamel: [30, 45, 55], camel: [30, 45, 55],
  olivgrön: [80, 40, 35], olive: [80, 40, 35],
  korall: [15, 70, 60], coral: [15, 70, 60],
  lavendel: [270, 40, 70], lavender: [270, 40, 70],
  senapsgul: [45, 70, 45], mustard: [45, 70, 45],
  terrakotta: [15, 55, 45], terracotta: [15, 55, 45],
  taupe: [30, 15, 55],
  krämvit: [40, 25, 93], cream: [40, 25, 93],
  mint: [160, 50, 70], mintgrön: [160, 50, 70],
  salvia: [140, 20, 55], sage: [140, 20, 55],
};

function isNeutralHSL(hsl: [number, number, number]): boolean {
  return hsl[1] < 15 || hsl[2] < 12 || hsl[2] > 90;
}

function getColorTemp(colorName: string): 'warm' | 'cool' | 'neutral' {
  const hsl = COLOR_HSL[colorName.toLowerCase().trim()];
  if (!hsl) return 'neutral';
  if (isNeutralHSL(hsl)) return 'neutral';
  const h = hsl[0];
  // Warm: reds, oranges, yellows, warm greens (hue 0-60 or 330-360)
  if (h <= 60 || h >= 330) return 'warm';
  // Cool: blues, cool greens, purples (hue 180-330)
  if (h >= 180 && h < 330) return 'cool';
  // Green zone 60-180: warm-leaning below 120, cool-leaning above
  return h < 120 ? 'warm' : 'cool';
}

function computeColorTemperature(garments: Garment[]): ColorTemperatureData {
  let warmCount = 0;
  let coolCount = 0;
  let neutralCount = 0;

  for (const g of garments) {
    const temp = getColorTemp(g.color_primary || '');
    if (temp === 'warm') warmCount++;
    else if (temp === 'cool') coolCount++;
    else neutralCount++;
  }

  const totalChromatic = warmCount + coolCount;
  const temperature = totalChromatic > 0
    ? (warmCount - coolCount) / totalChromatic  // -1 to +1
    : 0;

  let dominantPalette: ColorTemperatureData['dominantPalette'] = 'balanced';
  if (totalChromatic === 0) dominantPalette = 'neutral';
  else if (temperature > 0.3) dominantPalette = 'warm';
  else if (temperature < -0.3) dominantPalette = 'cool';

  return { temperature, warmCount, coolCount, neutralCount, totalChromatic, dominantPalette };
}

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
  usedGarments: (Garment & { wearCountLast30: number })[];
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
      const allUsedGarments = garments
        ?.filter(g => wearCountMap[g.id])
        .map(g => ({ ...g, wearCountLast30: wearCountMap[g.id] || 0 }))
        .sort((a, b) => b.wearCountLast30 - a.wearCountLast30) || [];
      
      const topFiveWorn = allUsedGarments.slice(0, 5);
      
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
