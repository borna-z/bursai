import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { normalizeWeather } from '@/lib/outfitContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export interface WeekDayRequest {
  date: string; // yyyy-MM-dd
  occasion: string;
  weather: {
    temperature?: number;
    precipitation?: string;
    wind?: string;
  };
  event_title?: string;
}

interface WeekDayResult {
  date: string;
  occasion: string;
  items: { slot: string; garment_id: string }[] | null;
  explanation?: string;
  style_score?: Record<string, number>;
  confidence_score?: number;
  confidence_level?: string;
  family_label?: string;
  error?: string;
  backup?: {
    items: { slot: string; garment_id: string }[];
    style_score?: Record<string, number>;
    family_label?: string;
  } | null;
}

interface WeekGenerationResult {
  days: WeekDayResult[];
  laundry?: {
    count: number;
    items: { id: string; title: string; category: string }[];
    warning: string | null;
  };
}

export function useWeekGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100

  const generateWeek = async (
    days: WeekDayRequest[],
    options?: { style?: string | null; locale?: string }
  ): Promise<WeekGenerationResult | null> => {
    if (!user) return null;

    setIsGenerating(true);
    setProgress(10);

    try {
      const normalizedDays = days.map(d => ({
        date: d.date,
        occasion: d.occasion,
        weather: normalizeWeather(d.weather as Record<string, unknown>),
        event_title: d.event_title || null,
      }));

      setProgress(20);

      const { data, error } = await invokeEdgeFunction<WeekGenerationResult>('burs_style_engine', {
        timeout: 60000, // Week generation may take longer
        body: {
          mode: 'plan_week',
          days: normalizedDays,
          style: options?.style || null,
          locale: options?.locale || 'en',
        },
      });

      setProgress(70);

      if (error) throw new Error(error.message || 'Week generation failed');
      if (!data?.days) throw new Error('No results returned');

      // Save each successful day as outfit + planned_outfit
      const savedDays: WeekDayResult[] = [];

      for (const dayResult of data.days) {
        if (!dayResult.items || dayResult.error) {
          savedDays.push(dayResult);
          continue;
        }

        try {
          // Save outfit
          const { data: outfit, error: outfitError } = await supabase
            .from('outfits')
            .insert({
              user_id: user.id,
              occasion: dayResult.occasion,
              style_vibe: options?.style || null,
              weather: dayResult.items ? undefined : null,
              explanation: dayResult.explanation || '',
              saved: true,
              style_score: dayResult.style_score || null,
            })
            .select()
            .single();

          if (outfitError) throw outfitError;

          // Save outfit items
          const outfitItems = dayResult.items.map(item => ({
            outfit_id: outfit.id,
            garment_id: item.garment_id,
            slot: item.slot,
          }));

          await supabase.from('outfit_items').insert(outfitItems);

          // Create planned outfit entry
          await supabase.from('planned_outfits').insert({
            user_id: user.id,
            date: dayResult.date,
            outfit_id: outfit.id,
            status: 'planned',
          });

          savedDays.push({ ...dayResult, items: dayResult.items });
        } catch (err) {
          console.error(`Failed to save outfit for ${dayResult.date}:`, err);
          savedDays.push({ ...dayResult, error: 'Failed to save' });
        }
      }

      setProgress(100);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfits'] });
      queryClient.invalidateQueries({ queryKey: ['planned-outfits-day'] });

      return { ...data, days: savedDays };
    } catch (err) {
      console.error('Week generation error:', err);
      throw err;
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  return { generateWeek, isGenerating, progress };
}
