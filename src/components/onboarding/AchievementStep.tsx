import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_CURVE } from '@/lib/motion';
import { safeT } from '@/lib/i18nFallback';

interface AchievementStepProps {
  onComplete: () => void;
}

/**
 * Wave 7 P48 — Achievement screen.
 *
 * Frontend-only celebration shown immediately after BatchCapture and before
 * StudioSelection. Acknowledges the user's effort, sets expectation for the
 * "3 free studio renders" the next step uses, and primes them to choose
 * which 3 garments to render.
 *
 * Scope decision: the LAUNCH_PLAN.md P48 spec calls for an additional
 * `grant_trial_gift` edge function that calls the `grant_trial_gift_atomic`
 * RPC to credit the user with 3 render credits. CLAUDE.md's "Never add new
 * edge functions unless the prompt explicitly says to" hard rule (combined
 * with the user being asleep when this PR was built) means we ship the
 * celebratory SCREEN now and defer the credit grant to a follow-up PR. The
 * RPC + helper (`grantTrialGift` in `_shared/render-credits.ts:300`) already
 * exist; the follow-up is ~50 LOC: a new `grant_trial_gift` edge function
 * + a `useEffect` mount hook here that calls
 * `invokeEdgeFunction('grant_trial_gift', { body: { idempotency_key:
 * `onboarding_gift_${userId}` } })`. Idempotency means a re-mount during
 * dev hot-reload or a network retry won't double-credit.
 *
 * Until then, P49 (StudioSelection) cannot render — that's a known
 * future-PR dependency tracked in the launch plan.
 */
export function AchievementStep({ onComplete }: AchievementStepProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="page-shell !max-w-lg !px-6 !pb-28 !pt-[calc(var(--safe-area-top)+6rem)] page-cluster">
        <Card surface="editorial" className="overflow-hidden p-7">
          {/* Warm-gold accent halo behind the icon — subtle radial wash, not a
              dot, to feel celebratory without crossing into "celebration
              graphic" territory. Matches the editorial restraint of
              GetStartedStep + PhotoTutorialStep. */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--accent)/0.16),transparent_70%)] blur-2xl"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.42, ease: EASE_CURVE }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[1.45rem] bg-accent/10 ring-1 ring-accent/30"
            >
              <Sparkles className="h-8 w-8 text-accent" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.32, ease: EASE_CURVE }}
            className="mt-6 text-center"
          >
            <p className="label-editorial tracking-[0.18em] text-accent">
              {safeT(t, 'achievement.eyebrow', 'Wardrobe captured')}
            </p>
            <h1 className="mt-3 font-display text-[1.85rem] italic font-medium leading-tight tracking-[-0.02em] text-foreground">
              {safeT(t, 'achievement.title', 'Your studio is ready.')}
            </h1>
            <p className="mt-3 text-[0.92rem] leading-6 text-muted-foreground">
              {safeT(
                t,
                'achievement.subtitle',
                'You did the hard part. Now the magic begins.',
              )}
            </p>
          </motion.div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.32, ease: EASE_CURVE }}
        >
          <Card surface="utility" className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-accent/12 ring-1 ring-accent/25">
                <span className="font-display text-[1.05rem] italic font-medium text-accent">
                  3
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.92rem] font-medium text-foreground">
                  {safeT(t, 'achievement.gift.title', 'Three studio renders, on us')}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                  {safeT(
                    t,
                    'achievement.gift.body',
                    'Pick three favourite pieces and we’ll turn them into clean, magazine-ready studio shots — yours to keep.',
                  )}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="action-bar-floating rounded-[1.6rem] p-3">
          <Button onClick={onComplete} size="lg" className="w-full">
            {safeT(t, 'achievement.cta_label', 'Choose my 3 pieces')}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
