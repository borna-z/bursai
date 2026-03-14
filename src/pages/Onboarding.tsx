import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { Loader2 } from 'lucide-react';
import { useUpdateProfile, useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { AccentColorStep } from '@/components/onboarding/AccentColorStep';
import { QuickStyleQuiz } from '@/components/onboarding/QuickStyleQuiz';
import { QuickUploadStep } from '@/components/onboarding/QuickUploadStep';
import { GetStartedStep } from '@/components/onboarding/GetStartedStep';
import type { StyleProfileV3 } from '@/components/onboarding/StyleQuizV3';
import { asPreferences } from '@/types/preferences';
import { toast } from 'sonner';

const STEPS = ['lang', 'accent', 'quiz', 'upload', 'getstarted'] as const;
type StepKey = typeof STEPS[number];

function StepProgress({ current }: { current: StepKey }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex gap-1.5 px-6 pt-3 pb-2">
      {STEPS.map((step, i) => (
        <motion.div
          key={step}
          className="h-[3px] flex-1 rounded-full overflow-hidden bg-border dark:bg-white/[0.06]"
        >
          <motion.div
            className="h-full bg-foreground dark:bg-white/40 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: i <= idx ? '100%' : '0%' }}
            transition={{ duration: 0.4, ease: EASE_CURVE }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const updateProfile = useUpdateProfile();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [languageStepDone, setLanguageStepDone] = useState(false);
  const [accentStepDone, setAccentStepDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const completeOnboarding = async () => {
    const currentPrefs = asPreferences(profile?.preferences);
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        onboarding: { completed: true },
      } as Record<string, unknown>,
    });
  };

  const handleQuizComplete = async (sp: StyleProfileV3) => {
    setIsSavingQuiz(true);
    try {
      const currentPrefs = asPreferences(profile?.preferences);
      const updates: Record<string, unknown> = {
        preferences: {
          ...currentPrefs,
          styleProfile: { ...sp },
          favoriteColors: sp.favoriteColors,
          dislikedColors: sp.dislikedColors,
          fitPreference: sp.fit,
          styleVibe: sp.styleWords[0] || 'smart-casual',
          genderNeutral: sp.genderNeutral === 'yes',
        },
      };
      if (sp.height && !isNaN(Number(sp.height))) {
        updates.height_cm = Number(sp.height);
      }
      await updateProfile.mutateAsync(updates);
      setQuizDone(true);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Profile not found') || msg.includes('foreign key') || (err as any)?.code === '23503') {
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
    } catch { /* ignore */ }
    navigate(path);
  };

  // Redirect if already completed
  const prefs = asPreferences(profile?.preferences);
  const onboardingCompleted = prefs?.onboarding?.completed === true;

  if (profileLoading || adminLoading) {
    return (
      <div className="dark-landing min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  // Skip language step for non-admin users
  const effectiveLanguageDone = isAdmin ? languageStepDone : true;

  const stepKey: StepKey = !effectiveLanguageDone
    ? 'lang'
    : !accentStepDone
      ? 'accent'
      : !quizDone
        ? 'quiz'
        : !uploadDone
          ? 'upload'
          : 'getstarted';

  return (
    <>
      <StepProgress current={stepKey} />
      <AnimatePresence mode="wait">
        <motion.div
          key={stepKey}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: EASE_CURVE }}
        >
          {stepKey === 'lang' && <LanguageStep onComplete={() => setLanguageStepDone(true)} />}
          {stepKey === 'accent' && <AccentColorStep onComplete={() => setAccentStepDone(true)} />}
          {stepKey === 'quiz' && (
            <QuickStyleQuiz
              onComplete={handleQuizComplete}
              onSkip={async () => setQuizDone(true)}
              isSaving={isSavingQuiz}
            />
          )}
          {stepKey === 'upload' && (
            <QuickUploadStep
              onComplete={() => setUploadDone(true)}
              onSkip={() => setUploadDone(true)}
            />
          )}
          {stepKey === 'getstarted' && <GetStartedStep onAction={handleGetStartedAction} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
