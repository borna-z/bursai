import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Sparkles, Gem } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInsights } from '@/hooks/useInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeather } from '@/hooks/useWeather';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { hapticLight } from '@/lib/haptics';
import { stripBrands } from '@/lib/stripBrands';
import { getOccasionLabel } from '@/lib/occasionLabel';
import type { Garment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

const OCCASIONS = ['vardag', 'jobb', 'dejt', 'fest', 'casual', 'smart_casual'];

interface GeneratedOutfitCard {
  id: string;
  occasion: string;
  explanation: string;
  items: { slot: string; garment: Garment }[];
}

export default function UnusedOutfits() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: insights } = useInsights();
  const { weather } = useWeather();
  const queryClient = useQueryClient();

  const [outfits, setOutfits] = useState<GeneratedOutfitCard[]>([]);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const unusedIds = insights?.unusedGarments?.map(g => g.id) || [];
  const unusedSet = new Set(unusedIds);

  const generate = useCallback(async () => {
    if (!user || unusedIds.length === 0) return;
    setGenerating(true);
    setError(null);
    setOutfits([]);

    const weatherPayload = weather
      ? { temperature: weather.temperature, precipitation: weather.precipitation || 'none', wind: weather.wind || 'low' }
      : { precipitation: 'none', wind: 'low' };

    const results: GeneratedOutfitCard[] = [];

    for (let i = 0; i < 6; i++) {
      try {
        const occasion = OCCASIONS[i % OCCASIONS.length];
        const { data, error: fnErr } = await invokeEdgeFunction<{
          items?: { garment_id: string; slot: string }[];
          explanation?: string;
          style_score?: Record<string, number> | null;
          error?: string;
        }>('burs_style_engine', {
          body: {
            mode: 'generate',
            occasion,
            weather: weatherPayload,
            locale,
            prefer_garment_ids: unusedIds,
          },
        });

        if (fnErr || data?.error || !data?.items?.length) continue;

        const garmentIds = data.items.map((it: { garment_id: string; slot: string }) => it.garment_id);
        const { data: garments } = await supabase
          .from('garments')
          .select('*')
          .in('id', garmentIds);

        if (!garments?.length) continue;
        const gMap = new Map(garments.map((g: Garment) => [g.id, g]));

        // Save outfit
        const { data: outfit, error: oErr } = await supabase
          .from('outfits')
          .insert([{
            user_id: user.id,
            occasion,
            explanation: data.explanation || '',
            weather: weatherPayload,
            saved: true,
            style_score: data.style_score || null,
          }])
          .select()
          .single();

        if (oErr || !outfit) continue;

        const items = data.items
          .map((it: { garment_id: string; slot: string }) => ({ slot: it.slot, garment: gMap.get(it.garment_id) as Garment }))
          .filter((it): it is { slot: string; garment: Garment } => !!it.garment);

        await supabase.from('outfit_items').insert(
          items.map((it) => ({ outfit_id: outfit.id, garment_id: it.garment.id, slot: it.slot }))
        );

        const card: GeneratedOutfitCard = {
          id: outfit.id,
          occasion,
          explanation: data.explanation || '',
          items,
        };
        results.push(card);
        setOutfits([...results]);
      } catch {
        // Skip failed generation, continue
      }
    }

    if (results.length === 0) {
      setError(t('common.error'));
    }
    setGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['outfits', user?.id] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, unusedIds.length, weather, locale, t, queryClient]);

  useEffect(() => {
    if (startedRef.current || !insights || unusedIds.length === 0) return;
    startedRef.current = true;
    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights, unusedIds.length]);

  return (
    <AnimatedPage className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/40 active:scale-95">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 style={{
              fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
              fontSize: 18, color: '#1C1917', margin: 0,
            }}>
              Sleeping Beauties
            </h1>
            <p style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: 11,
              color: 'rgba(28,25,23,0.5)', margin: '2px 0 0',
            }}>
              {unusedIds.length} garment{unusedIds.length !== 1 ? 's' : ''} waiting to be styled
            </p>
          </div>
          {!generating && outfits.length > 0 && (
            <Button variant="ghost" size="icon" onClick={() => { hapticLight(); startedRef.current = false; generate(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-4">
        {/* Generating state */}
        {generating && outfits.length === 0 && (
          <div className="space-y-3">
            <AILoadingOverlay
              variant="inline"
              phases={[
                { icon: Sparkles, label: t('ai.scanning_wardrobe'), duration: 1500 },
                { icon: Sparkles, label: t('ai.creating_combinations'), duration: 2000 },
                { icon: Sparkles, label: t('ai.assembling_outfits'), duration: 0 },
              ]}
              showSkeletons={3}
              className="py-4"
            />
          </div>
        )}

        {/* Error */}
        {error && !generating && (
          <div className="rounded-xl border border-border/30 p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { startedRef.current = false; generate(); }}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Outfit grid */}
        {outfits.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((outfit, i) => (
              <motion.button
                key={outfit.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => { hapticLight(); navigate(`/outfits/${outfit.id}`); }}
                className="rounded-xl border border-border/30 overflow-hidden bg-card text-left hover:border-accent/30 transition-colors active:scale-[0.98]"
              >
                {/* Garment thumbnails grid */}
                <div className="grid grid-cols-2 aspect-square">
                  {outfit.items.slice(0, 4).map((item, j) => {
                    const isUnused = unusedSet.has(item.garment.id);
                    return (
                      <div key={j} className="relative overflow-hidden bg-muted/20">
                        <LazyImageSimple
                          imagePath={getPreferredGarmentImagePath(item.garment)}
                          alt={stripBrands(item.garment.title)}
                          className="w-full h-full object-cover"
                        />
                        {isUnused && (
                          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-accent/90 text-accent-foreground text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                            <Gem className="w-2.5 h-2.5" />
                            {t('unused_outfits.unused_badge')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {outfit.items.length < 4 && Array.from({ length: 4 - outfit.items.length }).map((_, j) => (
                    <div key={`empty-${j}`} className="bg-muted/10" />
                  ))}
                </div>
                <div className="p-3 space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-accent font-medium">
                    {getOccasionLabel(outfit.occasion, t)}
                  </span>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {outfit.explanation}
                  </p>
                </div>
              </motion.button>
            ))}
            {/* Show skeletons for remaining slots while still generating */}
            {generating && Array.from({ length: Math.max(0, 6 - outfits.length) }).map((_, i) => (
              <div key={`skel-${i}`} className="rounded-xl border border-border/30 overflow-hidden">
                <Skeleton className="aspect-square" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Partial failure — some outfits generated but not all 6 */}
        {!generating && outfits.length > 0 && outfits.length < 6 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <p className="text-xs text-muted-foreground">
              {outfits.length}/6
            </p>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 press"
              onClick={() => { hapticLight(); startedRef.current = false; generate(); }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t('common.retry')}
            </Button>
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
