import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Camera,
  Layers,
  Shirt,
  Sparkles,
  Sun,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageIntro } from '@/components/ui/page-intro';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { EASE_CURVE } from '@/lib/motion';
import { safeT } from '@/lib/i18nFallback';

interface CoachTourStepProps {
  onComplete: () => void;
}

interface Tip {
  icon: typeof Sun;
  titleKey: string;
  bodyKey: string;
  titleFallback: string;
  bodyFallback: string;
}

/**
 * 5 tip cards walking the user through the app's primary surfaces. Order
 * mirrors the spec's Home → Wardrobe → Outfits → AI Chat → Garment Detail
 * flow. Each tip is a short, declarative pointer — not a tutorial — because
 * the actual app-shell tour overlays (CoachMark + useFirstRunCoach) are
 * out-of-scope for this PR. The user's mental model after this screen:
 * "the app has these 5 things, and my studio renders are cooking right now."
 */
const TIPS: Tip[] = [
  {
    icon: Sun,
    titleKey: 'coachTour.tip_home_title',
    titleFallback: 'Home — your daily plan',
    bodyKey: 'coachTour.tip_home_body',
    bodyFallback: 'Weather, calendar, and a fresh outfit suggestion every morning.',
  },
  {
    icon: Shirt,
    titleKey: 'coachTour.tip_wardrobe_title',
    titleFallback: 'Wardrobe — every piece you own',
    bodyKey: 'coachTour.tip_wardrobe_body',
    bodyFallback: 'Tap any garment to see how often you wear it and what pairs best.',
  },
  {
    icon: Layers,
    titleKey: 'coachTour.tip_outfits_title',
    titleFallback: 'Outfits — saved looks',
    bodyKey: 'coachTour.tip_outfits_body',
    bodyFallback: 'Generate combinations from what you own. Save the ones you love.',
  },
  {
    icon: Bot,
    titleKey: 'coachTour.tip_chat_title',
    titleFallback: 'AI Stylist — chat with the engine',
    bodyKey: 'coachTour.tip_chat_body',
    bodyFallback: 'Ask for a refined look. "Make it warmer." "Swap the shoes."',
  },
  {
    icon: Camera,
    titleKey: 'coachTour.tip_renders_title',
    titleFallback: 'Studio renders — your three picks',
    bodyKey: 'coachTour.tip_renders_body',
    bodyFallback: 'Open any garment to see its clean studio shot. They render in the background.',
  },
];

/**
 * Wave 7 P50 — CoachTour screen.
 *
 * Shown immediately after StudioSelection (P49) submitted 3 render jobs.
 * Walks the user through the app's primary surfaces with 5 tip cards while
 * their renders cook in the background. The next step (P51 Reveal) shows
 * the rendered result with celebratory copy.
 *
 * Realtime subscription
 * ---------------------
 * The spec calls for a "realtime subscription to render_status." We
 * subscribe to `postgres_changes` on the `garments` table for the active
 * user, and watch the EXACT 3 garments P49 enqueued via the render_jobs
 * table — querying the 3 most-recent non-terminal render_jobs for this
 * user gives us the canonical set (P49 lets the user pick ANY 3 from
 * their wardrobe via a grid, so "3 most-recent garments" is the wrong
 * proxy when the user picks older items — code-reviewer P1 round 1).
 * When ANY watched garment flips to `render_status='ready'`, we set
 * `firstRenderReady=true` and the primary CTA's copy + accent shifts so
 * the user knows their first render is waiting.
 *
 * Failure handling: if the subscription fails to connect (rare network
 * blip, Realtime service hiccup, etc.), the component still works — the
 * user sees the standard CTA copy, taps it, and advances to P51 which has
 * its own render-readiness logic. We log the subscription error and move
 * on. We deliberately do NOT block the CTA on a successful subscription.
 *
 * Polling fallback: not implemented. The next step (P51 Reveal) re-queries
 * the garments table on mount, so a subscription failure here is purely
 * cosmetic — the user gets the same final destination, just without the
 * "first render is ready" hint copy.
 */
export function CoachTourStep({ onComplete }: CoachTourStepProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [firstRenderReady, setFirstRenderReady] = useState(false);

  // Source-of-truth for the 3 watched garments: the 3 most-recent
  // non-terminal render_jobs for this user. P49 enqueued exactly 3, and
  // they're the newest by created_at. Status filter avoids picking up
  // already-completed jobs from a previous session (`'succeeded'` /
  // `'failed'` are terminal per the schema CHECK constraint).
  const { data: watchedJobs } = useQuery({
    queryKey: ['coach-tour-render-jobs', user?.id],
    enabled: Boolean(user?.id),
    staleTime: Infinity, // one-shot read at mount; the realtime channel handles updates
    queryFn: async () => {
      const { data, error } = await supabase
        .from('render_jobs')
        .select('garment_id')
        .eq('user_id', user!.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) {
        console.warn('[CoachTourStep] render_jobs fetch failed (non-fatal):', error.message);
        return [] as { garment_id: string }[];
      }
      return data ?? [];
    },
  });

  // Keep the watched-IDs Set in a ref so the realtime channel filter doesn't
  // churn on every re-render — captured once when subscription mounts.
  const watchedIdsRef = useRef<Set<string>>(new Set());
  const watchedIds = useMemo(() => {
    if (!watchedJobs || watchedJobs.length === 0) return [] as string[];
    return watchedJobs.map((row) => row.garment_id);
  }, [watchedJobs]);

  // Detect "already ready before we subscribed" — if the user's renders
  // finished while they were tapping through StudioSelection's submit
  // (unlikely on a fresh enqueue, but possible on a hot retry), the realtime
  // UPDATE event won't fire because no state change happens after mount.
  // We do a one-shot lookup against `garments` for the watched IDs to cover
  // the gap — only fires if we have IDs and haven't already detected ready.
  useEffect(() => {
    if (firstRenderReady) return;
    if (watchedIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('garments')
        .select('id, render_status')
        .in('id', watchedIds);
      if (cancelled) return;
      if (error) return;
      if ((data ?? []).some((g) => g.render_status === 'ready')) {
        setFirstRenderReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [watchedIds, firstRenderReady]);

  useEffect(() => {
    if (!user?.id) return;
    if (watchedIds.length === 0) return;
    // Snapshot the watched-IDs Set on the channel that we're about to
    // subscribe — keeps the listener stable even if React re-renders.
    watchedIdsRef.current = new Set(watchedIds);
    const idSet = watchedIdsRef.current;

    const channel = supabase
      .channel(`coach-tour-${user.id}`)
      .on(
        // postgres_changes is loosely typed in supabase-js; the cast keeps
        // TypeScript happy without dragging in the full RealtimePostgres
        // generic chain.
        'postgres_changes' as never,
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'garments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { new?: { id?: string; render_status?: string } }) => {
          const next = payload.new;
          if (!next?.id || !next.render_status) return;
          if (!idSet.has(next.id)) return;
          if (next.render_status === 'ready') {
            setFirstRenderReady(true);
          }
        },
      )
      .subscribe((status, err) => {
        // Non-fatal: a failed subscription doesn't strand the user — the
        // CTA still advances them, P51 re-queries on mount.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[CoachTourStep] realtime subscribe failed (non-fatal):', status, err);
        }
      });

    return () => {
      // Clean up the channel on unmount — important so a fast nav between
      // onboarding steps doesn't leak a long-lived websocket connection.
      void supabase.removeChannel(channel);
    };
  }, [user?.id, watchedIds]);

  const ctaCopy = firstRenderReady
    ? safeT(t, 'coachTour.cta_label_with_render', 'Show me my renders')
    : safeT(t, 'coachTour.cta_label', "I'm ready");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-32 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="overflow-hidden p-6">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.16),transparent_70%)] blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.42, ease: EASE_CURVE }}
              className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-accent/10 ring-1 ring-accent/30"
            >
              <Sparkles className="h-7 w-7 text-accent" />
            </motion.div>
          </div>

          <div className="mt-5">
            <PageIntro
              center
              eyebrow={safeT(t, 'coachTour.eyebrow', 'Quick tour')}
              title={safeT(t, 'coachTour.title', "Welcome to BURS — let's take a quick tour.")}
              description={safeT(
                t,
                'coachTour.subtitle',
                'Five things to know while your studio renders cook in the background.',
              )}
            />
          </div>
        </Card>

        <Card surface="utility" className="p-5">
          <ul className="space-y-4">
            {TIPS.map((tip, index) => {
              const Icon = tip.icon;
              return (
                <motion.li
                  key={tip.titleKey}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.28, ease: EASE_CURVE }}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] bg-secondary/70 text-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.92rem] font-medium text-foreground">
                      {safeT(t, tip.titleKey, tip.titleFallback)}
                    </p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-muted-foreground">
                      {safeT(t, tip.bodyKey, tip.bodyFallback)}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </Card>

        {firstRenderReady ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE_CURVE }}
            className="mx-auto flex items-center justify-center gap-2 text-[0.82rem] text-accent"
            role="status"
            aria-live="polite"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {safeT(
                t,
                'coachTour.first_render_ready',
                'Your first render is ready.',
              )}
            </span>
          </motion.div>
        ) : null}

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button onClick={onComplete} size="lg" className="w-full">
            {firstRenderReady ? <Sparkles className="h-4 w-4" /> : null}
            {ctaCopy}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
