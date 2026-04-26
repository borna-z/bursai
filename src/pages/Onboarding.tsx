import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import type { Json } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { GetStartedStep } from '@/components/onboarding/GetStartedStep';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { QuickStyleQuiz } from '@/components/onboarding/QuickStyleQuiz';
import { QuickUploadStep } from '@/components/onboarding/QuickUploadStep';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { mannequinPresentationFromStyleProfileGender } from '@/lib/mannequinPresentation';
import { advanceOnboardingStep } from '@/lib/advanceOnboardingStep';
import { asPreferences } from '@/types/preferences';

import type { StyleProfileV3 } from '@/components/onboarding/StyleQuizV3';

const STEPS = ['lang', 'quiz', 'upload', 'getstarted'] as const;
type StepKey = typeof STEPS[number];

function StepProgress({ current }: { current: StepKey }) {
  const index = STEPS.indexOf(current);

  return (
    <div className="fixed inset-x-5" style={{ top: 'calc(var(--safe-area-top) + 16px)', zIndex: 'var(--z-modal)' as unknown as number }}>
      <div className="mx-auto max-w-md rounded-full border border-border/60 bg-background/88 px-4 py-3 shadow-[0_14px_36px_rgba(28,25,23,0.08)] backdrop-blur-2xl">
        <div className="flex gap-1.5">
          {STEPS.map((step, stepIndex) => (
            <div key={step} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/35">
              <motion.div
                className="h-full rounded-full bg-foreground"
                initial={{ width: 0 }}
                animate={{ width: stepIndex <= index ? '100%' : '0%' }}
                transition={{ duration: 0.35, ease: EASE_CURVE }}
              />
            </div>
          ))}
        </div>
        <p className="label-editorial mt-2 text-center tracking-[0.18em]">
          Step {String(index + 1).padStart(2, '0')} of {String(STEPS.length).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  const [languageStepDone, setLanguageStepDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const completeOnboarding = async () => {
    if (!user) return;

    // Wave 7 P44: write the server-known `profiles.onboarding_step` column.
    // The new ProtectedRoute gate prefers this signal once the migration
    // applies.
    //
    // Failure handling: swallow ONLY the two error codes that signal
    // "RPC not deployed yet" — Supabase clients see PostgREST's
    // `PGRST202` (function absent from schema cache) before they ever see
    // raw Postgres `42883 function does not exist`. Both are tolerated to
    // cover direct-Postgres clients (tests, local dev) as well as the
    // primary PostgREST path. This is the deploy-window scenario between
    // Vercel auto-deploy and `npx supabase db push --linked --yes`.
    // ProtectedRoute's pre-migration fallback then trusts the legacy flag
    // we write below.
    //
    // All OTHER errors (transient network, ownership mismatch, invalid step,
    // etc.) propagate. Swallowing them post-migration would create split-
    // brain: legacy flag set, column still 'not_started' → ProtectedRoute
    // (column-based) keeps redirecting to /onboarding while Onboarding.tsx
    // sees `preferences.onboarding.completed=true` and bounces back to /.
    // The outer `handleGetStartedAction` already swallows the throw to keep
    // navigation moving for the user; Sentry/console will record the failure.
    try {
      await advanceOnboardingStep(user.id, 'completed');
    } catch (rpcError) {
      const code = (rpcError as { code?: string } | null)?.code;
      if (code !== '42883' && code !== 'PGRST202') throw rpcError;
      console.warn(
        'advance_onboarding_step RPC missing (deploy window — falling back to legacy flag):',
        rpcError,
      );
    }

    // Legacy preferences flag — primary signal for ProtectedRoute's
    // pre-migration fallback during the deploy window, secondary signal for
    // legacy consumers (useFirstRunCoach, etc.) post-migration. Always
    // written; this is the failure-resistant path.
    const currentPrefs = asPreferences(profile?.preferences);
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        onboarding: { completed: true },
      } as unknown as Json,
    });
  };

  const handleQuizComplete = async (styleProfile: StyleProfileV3) => {
    setIsSavingQuiz(true);
    try {
      const currentPrefs = asPreferences(profile?.preferences);
      const updates: Record<string, unknown> = {
        mannequin_presentation: mannequinPresentationFromStyleProfileGender(styleProfile.gender),
        preferences: {
          ...currentPrefs,
          styleProfile: { ...styleProfile },
          favoriteColors: styleProfile.favoriteColors,
          dislikedColors: styleProfile.dislikedColors,
          fitPreference: styleProfile.fit,
          styleVibe: styleProfile.styleWords[0] || 'smart-casual',
          genderNeutral: styleProfile.genderNeutral === 'yes',
        },
      };

      if (styleProfile.height && !Number.isNaN(Number(styleProfile.height))) {
        updates.height_cm = Number(styleProfile.height);
      }

      await updateProfile.mutateAsync(updates);
      setQuizDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const code = (error as { code?: string })?.code;

      if (message.includes('Profile not found') || message.includes('foreign key') || code === '23503') {
        toast.error(t('onboarding.sessionExpired') || 'Session expired. Please log out and sign in again.');
      } else {
        toast.error(t('onboarding.error'));
      }
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleGetStartedAction = async (path: string) => {
    try {
      await completeOnboarding();
    } catch {
      // Let navigation continue even if the profile update fails silently here.
    }
    navigate(path);
  };

  const preferences = asPreferences(profile?.preferences);
  const onboardingCompleted = preferences?.onboarding?.completed === true;

  if (profileLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background px-6 py-24">
        <div className="mx-auto max-w-md">
          <Card surface="editorial" className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </Card>
        </div>
      </div>
    );
  }

  if (onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  const effectiveLanguageDone = isAdmin ? languageStepDone : true;
  const stepKey: StepKey = !effectiveLanguageDone
    ? 'lang'
    : !quizDone
      ? 'quiz'
      : !uploadDone
        ? 'upload'
        : 'getstarted';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(157,126,86,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(88,99,148,0.08),transparent_26%)]"
      />

      <StepProgress current={stepKey} />

      <AnimatePresence mode="wait">
        <motion.div
          key={stepKey}
          initial={{ opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -36 }}
          transition={{ duration: 0.28, ease: EASE_CURVE }}
          className="relative z-10"
        >
          {stepKey === 'lang' ? <LanguageStep onComplete={() => { hapticLight(); setLanguageStepDone(true); }} /> : null}
          {stepKey === 'quiz' ? (
            <QuickStyleQuiz
              onComplete={(profile) => { hapticLight(); handleQuizComplete(profile); }}
              onSkip={async () => { hapticLight(); setQuizDone(true); }}
              isSaving={isSavingQuiz}
            />
          ) : null}
          {stepKey === 'upload' ? (
            <QuickUploadStep
              onComplete={() => { hapticLight(); setUploadDone(true); }}
              onSkip={() => { hapticLight(); setUploadDone(true); }}
            />
          ) : null}
          {stepKey === 'getstarted' ? <GetStartedStep onAction={(path) => { hapticLight(); handleGetStartedAction(path); }} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
