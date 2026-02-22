import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { Loader2 } from 'lucide-react';
import { useUpdateProfile, useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { AccentColorStep } from '@/components/onboarding/AccentColorStep';
import { StyleQuizV3, type StyleProfileV3 } from '@/components/onboarding/StyleQuizV3';
import { AppTutorialStep } from '@/components/onboarding/AppTutorialStep';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const updateProfile = useUpdateProfile();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [languageStepDone, setLanguageStepDone] = useState(false);
  const [accentStepDone, setAccentStepDone] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);

  const completeOnboarding = async () => {
    const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
    await updateProfile.mutateAsync({
      preferences: {
        ...currentPrefs,
        onboarding: { completed: true },
      },
    });
  };

  const handleQuizComplete = async (sp: StyleProfileV3) => {
    setIsSavingQuiz(true);
    try {
      const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
      const updates: Record<string, unknown> = {
        preferences: {
          ...currentPrefs,
          styleProfile: { ...sp },
          // Legacy compat keys
          favoriteColors: sp.favoriteColors,
          dislikedColors: sp.dislikedColors,
          fitPreference: sp.fit,
          styleVibe: sp.styleWords[0] || 'smart-casual',
          genderNeutral: sp.genderNeutral === 'yes',
        },
      };
      // Save height if provided
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

  const handleTutorialComplete = async () => {
    try {
      await completeOnboarding();
    } catch { /* ignore */ }
    navigate('/');
  };

  // Redirect if already completed
  const prefs = profile?.preferences as Record<string, any> | null;
  const onboardingCompleted = prefs?.onboarding?.completed === true;

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  const stepKey = !languageStepDone ? 'lang' : !accentStepDone ? 'accent' : !quizDone ? 'quiz' : 'tutorial';

  return (
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
          <StyleQuizV3
            onComplete={handleQuizComplete}
            onSkip={async () => {
              setQuizDone(true);
            }}
            isSaving={isSavingQuiz}
          />
        )}
        {stepKey === 'tutorial' && <AppTutorialStep onComplete={handleTutorialComplete} />}
      </motion.div>
    </AnimatePresence>
  );
}
