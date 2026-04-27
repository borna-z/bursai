import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/lazy-image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { enqueueRenderJob } from '@/lib/garmentIntelligence';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { EASE_CURVE } from '@/lib/motion';
import { safeT } from '@/lib/i18nFallback';

interface RevealStepProps {
  onComplete: () => void;
}

interface WatchedGarment {
  id: string;
  image_path: string | null;
  original_image_path: string | null;
  rendered_image_path: string | null;
  render_status: string | null;
}

/**
 * Wave 7 P51 — Reveal screen.
 *
 * Final onboarding step. Shows the user the first of their 3 trial-gift
 * studio renders with celebratory copy. The 3 render jobs were enqueued
 * during P49 (StudioSelection); P50 (CoachTour) walked the user through
 * the app while the renders cook. By the time we get here, at least one
 * is usually ready — but we handle every state:
 *
 * - **Ready (happy path)**: pick the first garment whose `render_status`
 *   is `'ready'` and `rendered_image_path` is set, display large with
 *   wow copy.
 * - **Still cooking**: realtime subscription on `garments` waits for the
 *   first one to flip to `'ready'`. Loading shimmer in the meantime.
 * - **Failed (auto-retry)**: if a watched garment is `'failed'`, fire ONE
 *   `enqueueRenderJob(id, 'retry')` automatically per the spec. While
 *   retry is in flight, fall back to the original photo so the user
 *   doesn't see a broken card. The retry uses the existing recovery
 *   tree (force=false; enqueue_render_job server-side dedups via
 *   client_nonce + reserve_key).
 *
 * Dependency radius:
 * - `enqueueRenderJob` from garmentIntelligence (already used by P49 +
 *   AddGarment + LiveScan; safe to import here).
 * - `getPreferredGarmentImagePath` for the rendered-vs-original fallback.
 *
 * The CTA is "Start using BURS" — it calls the parent `onComplete()`
 * which kicks off `completeOnboarding` in Onboarding.tsx (advances
 * server step `'reveal' → 'completed'` and writes the legacy
 * preferences flag).
 */
export function RevealStep({ onComplete }: RevealStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Fetch the canonical 3 watched render_job garment IDs (same pattern as
  // CoachTourStep). The status filter lets us pick up rows that completed
  // (succeeded/failed) BETWEEN P49's enqueue and this mount — we need
  // succeeded rows because that's the happy path here, AND we need failed
  // rows to trigger the auto-retry. Pending/in_progress are still in
  // flight. Limit 3 because P49 only enqueues 3.
  const { data: watchedJobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['reveal-render-jobs', user?.id],
    enabled: Boolean(user?.id),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('render_jobs')
        .select('garment_id, status')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) {
        console.warn('[RevealStep] render_jobs fetch failed (non-fatal):', error.message);
        return [] as { garment_id: string; status: string }[];
      }
      return data ?? [];
    },
  });

  const watchedIds = useMemo(() => {
    if (!watchedJobs) return [] as string[];
    return watchedJobs.map((j) => j.garment_id);
  }, [watchedJobs]);

  // Fetch the actual garment rows for the watched IDs. We need the full
  // image-path columns (`rendered_image_path` / `original_image_path` /
  // `image_path`) so we can pick the right URL via
  // `getPreferredGarmentImagePath`. The `setGarments` callback below also
  // updates this set when realtime UPDATE events fire.
  const [garments, setGarments] = useState<WatchedGarment[]>([]);

  useEffect(() => {
    if (!user?.id || watchedIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('garments')
        .select('id, image_path, original_image_path, rendered_image_path, render_status')
        .in('id', watchedIds);
      if (cancelled) return;
      if (error) {
        console.warn('[RevealStep] garments fetch failed (non-fatal):', error.message);
        return;
      }
      setGarments(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, watchedIds]);

  // Track which garments we've already auto-retried so a flapping
  // render_status doesn't trigger an infinite retry loop. The spec says
  // "auto-retry once" — `retriedRef.current.has(id)` is our guard.
  const retriedRef = useRef<Set<string>>(new Set());

  // Auto-retry failed renders ONCE per garment. Spec: "If failed,
  // auto-retry once + use original until ready." We don't await the
  // retry — fire-and-forget. The realtime subscription below will
  // pick up the eventual `'ready'` flip when (if) the retry succeeds.
  useEffect(() => {
    if (garments.length === 0) return;
    for (const g of garments) {
      if (g.render_status !== 'failed') continue;
      if (retriedRef.current.has(g.id)) continue;
      retriedRef.current.add(g.id);
      void enqueueRenderJob(g.id, 'retry').catch((err) => {
        // Non-fatal: original photo will continue showing until/unless
        // the retry eventually succeeds. We log but don't surface — the
        // user is on a celebratory screen.
        console.warn('[RevealStep] auto-retry failed (non-fatal):', g.id, err);
      });
    }
  }, [garments]);

  // Realtime subscription: same pattern as CoachTourStep, but here we
  // update the local `garments` state rather than just flipping a flag —
  // we want the latest `rendered_image_path` and `render_status` so the
  // UI can re-pick the hero image without a refetch.
  useEffect(() => {
    if (!user?.id || watchedIds.length === 0) return;
    const idSet = new Set(watchedIds);

    const channel = supabase
      .channel(`reveal-${user.id}`)
      .on(
        // postgres_changes is loosely typed in supabase-js — cast keeps TS
        // quiet without dragging in the full RealtimePostgres generic chain
        // (mirrors CoachTourStep's pattern).
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'garments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new?: WatchedGarment }) => {
          const next = payload.new;
          if (!next?.id) return;
          if (!idSet.has(next.id)) return;
          setGarments((prev) => {
            const idx = prev.findIndex((g) => g.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = prev.slice();
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[RevealStep] realtime subscribe failed (non-fatal):', status, err);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, watchedIds]);

  // Pick the hero garment: the first watched garment whose render is
  // ready (rendered_image_path set + status=='ready'). If none is ready
  // yet, prefer one that's still in-flight (pending/rendering) over a
  // failed-but-retrying one (so the wow copy + shimmer feels intentional
  // rather than apologetic). If only failed-and-retrying remain, fall
  // back to that — `getPreferredGarmentImagePath` returns the original
  // photo for the failed case.
  const hero = useMemo<WatchedGarment | null>(() => {
    if (garments.length === 0) return null;
    const readyOne = garments.find(
      (g) => g.render_status === 'ready' && g.rendered_image_path,
    );
    if (readyOne) return readyOne;
    const cookingOne = garments.find(
      (g) => g.render_status === 'pending' || g.render_status === 'rendering',
    );
    if (cookingOne) return cookingOne;
    return garments[0] ?? null;
  }, [garments]);

  const heroIsReady = hero?.render_status === 'ready' && Boolean(hero.rendered_image_path);
  const heroPath = hero ? getPreferredGarmentImagePath(hero) : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-32 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="overflow-hidden p-7">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.18),transparent_70%)] blur-3xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE_CURVE }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[1.45rem] bg-accent/12 ring-1 ring-accent/30"
            >
              <Sparkles className="h-8 w-8 text-accent" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.32, ease: EASE_CURVE }}
            className="mt-6 text-center"
          >
            <p className="label-editorial tracking-[0.18em] text-accent">
              {safeT(t, 'reveal.eyebrow', 'Look at that.')}
            </p>
            <h1 className="mt-3 font-display text-[2rem] italic font-medium leading-tight tracking-[-0.02em] text-foreground">
              {heroIsReady
                ? safeT(t, 'reveal.title_ready', 'Your studio shot is ready.')
                : safeT(t, 'reveal.title_cooking', "We're framing your first piece.")}
            </h1>
            <p className="mt-3 text-[0.92rem] leading-6 text-muted-foreground">
              {heroIsReady
                ? safeT(
                    t,
                    'reveal.subtitle_ready',
                    'The other two are still rendering — you can see them in your wardrobe whenever they land.',
                  )
                : safeT(
                    t,
                    'reveal.subtitle_cooking',
                    'It usually takes a moment. The first one will appear here as soon as it lands.',
                  )}
            </p>
          </motion.div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.32, ease: EASE_CURVE }}
        >
          <Card surface="utility" className="overflow-hidden p-3">
            <div
              role="img"
              aria-label={
                heroIsReady
                  ? safeT(t, 'reveal.hero_aria_ready', 'Your studio render')
                  : safeT(t, 'reveal.hero_aria_cooking', 'Studio render preview, still rendering')
              }
              className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.25rem] bg-secondary/40"
            >
              {heroPath ? (
                <LazyImage
                  src={heroPath}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
              {!heroIsReady ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px]"
                >
                  <motion.div
                    initial={{ opacity: 0.5, scale: 0.95 }}
                    animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1, 0.95] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-2 rounded-full bg-background/85 px-4 py-2 text-[0.78rem] text-foreground shadow-md"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                    <span>{safeT(t, 'reveal.cooking_label', 'Rendering…')}</span>
                  </motion.div>
                </div>
              ) : null}
            </div>
          </Card>
        </motion.div>

        {/* Empty / loading state — shown only on the very first paint while
            the render_jobs query and the garments fetch are still in flight.
            After that we always have at least the originals, so the hero
            card above shows the photo + shimmer. */}
        {jobsLoading && garments.length === 0 ? (
          <p
            className="text-center text-[0.82rem] text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {safeT(t, 'reveal.loading', 'Looking for your renders…')}
          </p>
        ) : null}

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button onClick={onComplete} size="lg" className="w-full">
            {safeT(t, 'reveal.cta_label', 'Start using BURS')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
