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
import { StyleQuizV4 } from '@/components/onboarding/StyleQuizV4';
import { PhotoTutorialStep } from '@/components/onboarding/PhotoTutorialStep';
import { BatchCaptureStep } from '@/components/onboarding/BatchCaptureStep';
import { EASE_CURVE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { mannequinPresentationFromStyleProfileGender } from '@/lib/mannequinPresentation';
import { advanceOnboardingStep } from '@/lib/advanceOnboardingStep';
import { asPreferences } from '@/types/preferences';

import { migrateV4ToV3Compat, type StyleProfileV4 } from '@/types/styleProfile';

const STEPS = ['lang', 'quiz', 'photo_tutorial', 'batch_capture', 'getstarted'] as const;
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
  const [photoTutorialDone, setPhotoTutorialDone] = useState(false);
  const [batchCaptureDone, setBatchCaptureDone] = useState(false);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const completeOnboarding = async () => {
    if (!user) return;

    // Wave 7 P44: write the server-known `profiles.onboarding_step` column.
    // The new ProtectedRoute gate prefers this signal once the migration
    // applies.
    //
    // Failure handling: ONLY swallow when ALL of the following are true:
    //   (1) the loaded profile genuinely lacks the `onboarding_step` column
    //       (pre-migration window — `useProfile`'s `.select('*')` doesn't
    //       return a column that doesn't exist on the row), AND
    //   (2) the RPC error code is `42883` (raw Postgres "function does not
    //       exist") OR `PGRST202` (PostgREST "function absent from schema
    //       cache").
    //
    // The column-existence gate matters because `PGRST202` is ALSO returned
    // when PostgREST's schema cache is stale POST-migration. Swallowing
    // indiscriminately in that window creates split-brain: column stays
    // `'not_started'`, legacy flag becomes `true`, ProtectedRoute
    // (column-based) redirects to `/onboarding`, Onboarding.tsx
    // (preferences-based) `Navigate to "/"`, redirect loop. Once the column
    // exists on the loaded profile, propagating any RPC error keeps both
    // flags aligned (neither set) — user retries on their own and
    // PostgREST eventually refreshes its cache. The outer
    // `handleGetStartedAction` already swallows the throw to keep
    // navigation moving for the user.
    //
    // All OTHER errors (transient network, ownership mismatch, invalid
    // step name, etc.) propagate per the same rationale.
    const profileLacksOnboardingColumn =
      (profile as { onboarding_step?: string | null } | null)?.onboarding_step ===
      undefined;
    try {
      await advanceOnboardingStep(user.id, 'completed');
    } catch (rpcError) {
      const code = (rpcError as { code?: string } | null)?.code;
      const isDeployWindowMissing = code === '42883' || code === 'PGRST202';
      if (!profileLacksOnboardingColumn || !isDeployWindowMissing) {
        throw rpcError;
      }
      console.warn(
        'advance_onboarding_step RPC missing (pre-migration window — falling back to legacy flag):',
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

  const handleQuizComplete = async (styleProfile: StyleProfileV4) => {
    // Throw rather than silently no-op (Codex round 8 P2 on PR #685): a
    // resolved void return signals "save succeeded" to StyleQuizV4, which
    // then clears the localStorage draft. If auth dropped at submit time,
    // a silent return would lose the user's answers without a retry path.
    if (!user) {
      toast.error(t('onboarding.sessionExpired') || 'Session expired. Please log out and sign in again.');
      throw new Error('No authenticated user');
    }
    setIsSavingQuiz(true);
    try {
      const currentPrefs = asPreferences(profile?.preferences);
      // Map V4 gender enum to the mannequin presentation helper's expected
      // 'male' | 'female' input. 'feminine'/'masculine' map directly;
      // 'neutral'/'prefer_not' fall through to 'mixed'.
      const mannequinInput =
        styleProfile.gender === 'feminine'
          ? 'female'
          : styleProfile.gender === 'masculine'
            ? 'male'
            : styleProfile.gender;

      // Wave 7 P45: persist a V4 record merged with V3-compat mirror keys so
      // legacy edge-function readers (`burs_style_engine`, `style_chat`,
      // `_shared/outfit-scoring.ts`) keep finding their expected fields
      // populated until they're migrated to read V4 directly. Without the
      // shim, new V4-only users would get silent AI-quality regression.
      const styleProfileForStorage = migrateV4ToV3Compat(styleProfile);
      const updates: Record<string, unknown> = {
        mannequin_presentation: mannequinPresentationFromStyleProfileGender(mannequinInput),
        preferences: {
          ...currentPrefs,
          styleProfile: styleProfileForStorage,
          favoriteColors: styleProfile.favoriteColors,
          dislikedColors: styleProfile.dislikedColors,
          fitPreference: styleProfile.fitOverall,
          styleVibe: styleProfile.archetypes[0] || 'smart-casual',
          genderNeutral: styleProfile.gender === 'neutral',
        },
      };

      if (styleProfile.height_cm && !Number.isNaN(styleProfile.height_cm) && styleProfile.height_cm > 0) {
        updates.height_cm = styleProfile.height_cm;
      }

      await updateProfile.mutateAsync(updates);

      // Wave 7 P45: advance backend state machine to the next step. This is
      // NOT 'completed' — that comes after later steps in the flow. Wrap in
      // try/catch so RPC errors during the deploy window (or transient
      // network) don't block the UI from progressing locally.
      try {
        await advanceOnboardingStep(user.id, 'photo_tutorial');
      } catch (rpcError) {
        console.warn('advance_onboarding_step(photo_tutorial) failed (non-fatal):', rpcError);
      }

      setQuizDone(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const code = (error as { code?: string })?.code;

      if (message.includes('Profile not found') || message.includes('foreign key') || code === '23503') {
        toast.error(t('onboarding.sessionExpired') || 'Session expired. Please log out and sign in again.');
      } else {
        toast.error(t('onboarding.error'));
      }
      // Rethrow so StyleQuizV4 keeps its localStorage draft on failure (P45
      // Codex round 1 P2 — draft must survive a failed parent persistence so
      // the user can retry without losing answers).
      throw error;
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handlePhotoTutorialComplete = async () => {
    // Wave 7 P46: advance backend state machine to 'batch_capture'. RPC errors
    // during the deploy window (or transient network) should NOT block the user
    // from progressing locally — toast + log, then advance the local step so
    // they aren't trapped on the tutorial screen. Mirrors the deploy-window
    // pattern used after the quiz step (P45).
    if (user) {
      try {
        await advanceOnboardingStep(user.id, 'batch_capture');
      } catch (rpcError) {
        console.warn('advance_onboarding_step(batch_capture) failed (non-fatal):', rpcError);
        toast.error(t('onboarding.error'));
      }
    }
    setPhotoTutorialDone(true);
  };

  const handleBatchCaptureComplete = async () => {
    // Wave 7 P47: advance backend state machine to 'achievement'. Mirrors the
    // deploy-window-tolerant pattern from handlePhotoTutorialComplete: log the
    // RPC error, surface a toast, but still flip the local flag so the user
    // moves on to GetStarted. Failure here doesn't strand the user — the
    // legacy `preferences.onboarding.completed` write later in the flow
    // remains the failure-resistant exit path.
    if (user) {
      try {
        await advanceOnboardingStep(user.id, 'achievement');
      } catch (rpcError) {
        console.warn('advance_onboarding_step(achievement) failed (non-fatal):', rpcError);
        toast.error(t('onboarding.error'));
      }
    }
    setBatchCaptureDone(true);
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
      : !photoTutorialDone
        ? 'photo_tutorial'
        : !batchCaptureDone
          ? 'batch_capture'
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
            <StyleQuizV4
              onComplete={(profile) => { hapticLight(); return handleQuizComplete(profile); }}
              onSkip={async () => { hapticLight(); setQuizDone(true); }}
              isSaving={isSavingQuiz}
              userId={user?.id}
            />
          ) : null}
          {stepKey === 'photo_tutorial' ? (
            <PhotoTutorialStep
              onComplete={() => { hapticLight(); handlePhotoTutorialComplete(); }}
            />
          ) : null}
          {stepKey === 'batch_capture' ? (
            <BatchCaptureStep
              onComplete={() => { hapticLight(); handleBatchCaptureComplete(); }}
            />
          ) : null}
          {stepKey === 'getstarted' ? <GetStartedStep onAction={(path) => { hapticLight(); handleGetStartedAction(path); }} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
