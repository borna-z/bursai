import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, RefreshCw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInsights } from '@/hooks/useInsights';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeather } from '@/hooks/useWeather';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { AnimatedPage } from '@/components/ui/animated-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { PageIntro } from '@/components/ui/page-intro';
import { Skeleton } from '@/components/ui/skeleton';
import { hapticLight } from '@/lib/haptics';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { stripBrands } from '@/lib/stripBrands';
import type { Garment } from '@/hooks/useGarments';

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

  const unusedIds = insights?.unusedGarments?.map((garment) => garment.id) || [];
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

    for (let index = 0; index < 6; index += 1) {
      try {
        const occasion = OCCASIONS[index % OCCASIONS.length];
        const { data, error: functionError } = await invokeEdgeFunction<{
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

        if (functionError || data?.error || !data?.items?.length) continue;

        const garmentIds = data.items.map((item: { garment_id: string; slot: string }) => item.garment_id);
        const { data: garments } = await supabase
          .from('garments')
          .select('*')
          .in('id', garmentIds);

        if (!garments?.length) continue;
        const garmentMap = new Map(garments.map((garment: Garment) => [garment.id, garment]));

        const { data: outfit, error: outfitError } = await supabase
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

        if (outfitError || !outfit) continue;

        const items = data.items
          .map((item: { garment_id: string; slot: string }) => ({
            slot: item.slot,
            garment: garmentMap.get(item.garment_id) as Garment,
          }))
          .filter((item): item is { slot: string; garment: Garment } => !!item.garment);

        await supabase.from('outfit_items').insert(
          items.map((item) => ({ outfit_id: outfit.id, garment_id: item.garment.id, slot: item.slot })),
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
        // Skip a failed generation and keep building the remaining set.
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
    <AppLayout hideNav>
      <PageHeader
        title="Sleeping Beauties"
        subtitle={`${unusedIds.length} garments waiting to be styled`}
        showBack
        actions={!generating && outfits.length > 0 ? (
          <Button
            variant="quiet"
            size="icon"
            onClick={() => {
              hapticLight();
              startedRef.current = false;
              generate();
            }}
            aria-label="Regenerate outfits"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        ) : undefined}
      />

      <AnimatedPage className="page-shell !px-5 !pt-6 page-cluster">
        <PageIntro
          eyebrow="Unused edit"
          meta={<span className="eyebrow-chip !bg-secondary/70">{unusedIds.length} waiting</span>}
          title="Wake up the pieces you forgot."
          description="BURS is building outfits around the garments your wardrobe has not used yet, so the quiet pieces get another chance."
        />

        {generating && outfits.length === 0 ? (
          <Card surface="editorial" className="space-y-4 p-5">
            <AILoadingOverlay
              variant="inline"
              phases={[
                { icon: Sparkles, label: t('ai.scanning_wardrobe'), duration: 1500 },
                { icon: Sparkles, label: t('ai.creating_combinations'), duration: 2000 },
                { icon: Sparkles, label: t('ai.assembling_outfits'), duration: 0 },
              ]}
              showSkeletons={3}
              className="py-2"
            />
          </Card>
        ) : null}

        {error && !generating ? (
          <EmptyState
            icon={Sparkles}
            title={error}
            description="We could not build a set from the unused garments this time."
            variant="editorial"
            compact
            action={{
              label: t('common.retry'),
              onClick: () => {
                startedRef.current = false;
                generate();
              },
            }}
          />
        ) : null}

        {outfits.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {outfits.map((outfit, index) => (
              <motion.button
                key={outfit.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => {
                  hapticLight();
                  navigate(`/outfits/${outfit.id}`);
                }}
                className="text-left"
              >
                <Card surface="utility" className="h-full overflow-hidden p-2">
                  <div className="grid aspect-square grid-cols-2 overflow-hidden rounded-[1.35rem]">
                    {outfit.items.slice(0, 4).map((item) => {
                      const isUnused = unusedSet.has(item.garment.id);

                      return (
                        <div key={item.garment.id} className="relative overflow-hidden bg-muted/20">
                          <LazyImageSimple
                            imagePath={getPreferredGarmentImagePath(item.garment)}
                            alt={stripBrands(item.garment.title)}
                            className="h-full w-full object-cover"
                          />
                          {isUnused ? (
                            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-foreground shadow-[0_8px_20px_rgba(28,25,23,0.08)]">
                              <Gem className="h-2.5 w-2.5" />
                              {t('unused_outfits.unused_badge')}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                    {outfit.items.length < 4
                      ? Array.from({ length: 4 - outfit.items.length }).map((_, index) => (
                        <div key={`empty-${index}`} className="bg-muted/10" />
                      ))
                      : null}
                  </div>

                  <div className="space-y-2 px-1 pb-1 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="eyebrow-chip !bg-secondary/70">
                        {getOccasionLabel(outfit.occasion, t)}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-6 text-foreground">
                      {outfit.explanation}
                    </p>
                  </div>
                </Card>
              </motion.button>
            ))}

            {generating
              ? Array.from({ length: Math.max(0, 6 - outfits.length) }).map((_, index) => (
                <Card key={`skeleton-${index}`} surface="utility" className="overflow-hidden p-2">
                  <Skeleton className="aspect-square rounded-[1.35rem]" />
                  <div className="space-y-2 px-1 pb-1 pt-4">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </Card>
              ))
              : null}
          </section>
        ) : null}

        {!generating && outfits.length > 0 && outfits.length < 6 ? (
          <Card surface="inset" className="p-4">
            <p className="label-editorial">Partial set</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              BURS found {outfits.length} strong looks from the unused pieces. Regenerate if you want a fresh pass.
            </p>
          </Card>
        ) : null}
      </AnimatedPage>
    </AppLayout>
  );
}
