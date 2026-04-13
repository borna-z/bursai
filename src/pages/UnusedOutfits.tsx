import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gem, RefreshCw, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
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
import { Skeleton } from '@/components/ui/skeleton';
import { hapticLight } from '@/lib/haptics';
import { getOccasionLabel } from '@/lib/occasionLabel';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { stripBrands } from '@/lib/stripBrands';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DISTANCE } from '@/lib/motion';
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
  const prefersReduced = useReducedMotion();

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

  const motionProps = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: DISTANCE.md }, animate: { opacity: 1, y: 0 } };

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('insights.unused_title') || 'Sleeping Beauties'}
        titleClassName="font-display italic"
        eyebrow="Insights"
        showBack
        actions={!generating && outfits.length > 0 ? (
          <Button
            variant="quiet"
            size="icon"
            className="rounded-full"
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

      <AnimatedPage className="page-shell !px-[var(--page-px)] !pt-6 page-cluster">
        {/* Editorial intro */}
        <motion.section
          {...motionProps}
          transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM }}
          className="space-y-2"
        >
          <h1 className="font-display italic text-[1.5rem] leading-tight text-foreground">
            Rediscover these looks
          </h1>
          <p className="font-body text-sm leading-6 text-muted-foreground">
            {t('insights.unused_desc') || 'Outfits built from pieces you haven\'t worn in 30+ days. Give them a second life.'}
          </p>
        </motion.section>

        {generating && outfits.length === 0 ? (
          <Card className="space-y-4 p-5 rounded-[1.25rem]">
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
          <section className="grid gap-4">
            {outfits.map((outfit, index) => (
              <motion.button
                key={outfit.id}
                type="button"
                {...(prefersReduced
                  ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
                  : { initial: { opacity: 0, y: DISTANCE.md }, animate: { opacity: 1, y: 0 } }
                )}
                transition={{
                  delay: index * STAGGER_DELAY * 2,
                  ease: EASE_CURVE,
                  duration: DURATION_MEDIUM,
                }}
                whileTap={prefersReduced ? undefined : { scale: 0.98 }}
                onClick={() => {
                  hapticLight();
                  navigate(`/outfits/${outfit.id}`);
                }}
                className="text-left w-full"
              >
                <Card className="h-full overflow-hidden rounded-[1.25rem] p-3">
                  <div className="flex gap-3">
                    {/* 2x2 image grid */}
                    <div className="grid w-[7.5rem] shrink-0 grid-cols-2 gap-1 overflow-hidden rounded-[1rem]">
                      {outfit.items.slice(0, 4).map((item) => {
                        const isUnused = unusedSet.has(item.garment.id);

                        return (
                          <div key={item.garment.id} className="relative aspect-square overflow-hidden bg-muted/20">
                            <LazyImageSimple
                              imagePath={getPreferredGarmentImagePath(item.garment)}
                              alt={stripBrands(item.garment.title)}
                              className="h-full w-full object-cover"
                            />
                            {isUnused ? (
                              <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[0.5rem] font-medium uppercase tracking-[0.12em] text-foreground">
                                <Gem className="h-2 w-2" />
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                      {outfit.items.length < 4
                        ? Array.from({ length: 4 - outfit.items.length }).map((_, emptyIndex) => (
                          <div key={`empty-${emptyIndex}`} className="aspect-square bg-muted/10" />
                        ))
                        : null}
                    </div>

                    {/* Text content */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
                      <div className="space-y-2">
                        <span className="label-editorial text-muted-foreground/60 text-[0.65rem] uppercase tracking-[0.16em]">
                          {getOccasionLabel(outfit.occasion, t)}
                        </span>
                        <p className="font-body text-sm font-medium leading-snug text-foreground line-clamp-3">
                          {outfit.explanation}
                        </p>
                      </div>
                      <p className="label-editorial text-muted-foreground/60 text-[0.6rem] uppercase tracking-[0.14em] mt-2">
                        {outfit.items.filter((item) => unusedSet.has(item.garment.id)).length} unused pieces
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.button>
            ))}

            {generating
              ? Array.from({ length: Math.max(0, 6 - outfits.length) }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="overflow-hidden rounded-[1.25rem] p-3">
                  <div className="flex gap-3">
                    <Skeleton className="w-[7.5rem] shrink-0 aspect-square rounded-[1rem]" />
                    <div className="flex-1 space-y-3 py-2">
                      <Skeleton className="h-3 w-16 rounded-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  </div>
                </Card>
              ))
              : null}
          </section>
        ) : null}

        {/* Inspirational footer card */}
        {!generating && outfits.length > 0 ? (
          <motion.div
            {...motionProps}
            transition={{ ease: EASE_CURVE, duration: DURATION_MEDIUM, delay: 0.2 }}
          >
            <Card className="rounded-[1.25rem] p-5 space-y-3">
              <Sparkles className="h-5 w-5 text-accent" />
              <p className="font-display italic text-[1.1rem] leading-tight text-foreground">
                Your closet is a living gallery.
              </p>
              <p className="font-body text-sm leading-6 text-muted-foreground">
                {outfits.length < 6
                  ? `BURS found ${outfits.length} strong looks from the unused pieces. Regenerate if you want a fresh pass.`
                  : 'Rotate these into your weekly plan and watch your cost-per-wear drop.'}
              </p>
            </Card>
          </motion.div>
        ) : null}
      </AnimatedPage>
    </AppLayout>
  );
}
