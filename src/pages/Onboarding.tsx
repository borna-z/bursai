import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Shirt, 
  Sparkles, 
  Bell, 
  Check, 
  Loader2,
  Wand2,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useUpdateProfile, useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { AccentColorStep } from '@/components/onboarding/AccentColorStep';
import { BodyMeasurementsStep } from '@/components/onboarding/BodyMeasurementsStep';
import { StylePreferencesStep, type StylePreferences } from '@/components/onboarding/StylePreferencesStep';
import { AppTutorialStep } from '@/components/onboarding/AppTutorialStep';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { 
    state, 
    progress, 
    currentStep,
    completeOnboarding,
    skipReminder,
    enableReminder,
    createDemoGarments,
    isLoading 
  } = useOnboarding();
  const updateProfile = useUpdateProfile();
  const { data: profile } = useProfile();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [isEnablingReminder, setIsEnablingReminder] = useState(false);
  // Pre-steps: 0 = language, 1 = body measurements
  const [languageStepDone, setLanguageStepDone] = useState(false);
  const [accentStepDone, setAccentStepDone] = useState(false);
  const [bodyStepDone, setBodyStepDone] = useState(false);
  const [isSavingBody, setIsSavingBody] = useState(false);
  const [styleStepDone, setStyleStepDone] = useState(false);
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);

  const handleSaveBodyMeasurements = async (data: { height_cm: number | null; weight_kg: number | null }) => {
    setIsSavingBody(true);
    try {
      const updates: Record<string, number | null> = {};
      if (data.height_cm !== null) updates.height_cm = data.height_cm;
      if (data.weight_kg !== null) updates.weight_kg = data.weight_kg;
      if (Object.keys(updates).length > 0) {
        await updateProfile.mutateAsync(updates);
      }
      setBodyStepDone(true);
    } catch {
      toast.error(t('onboarding.body_save_error'));
    } finally {
      setIsSavingBody(false);
    }
  };

  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    try {
      await createDemoGarments();
      toast.success(t('onboarding.demo_success'), {
        description: t('onboarding.demo_success_desc'),
      });
    } catch {
      toast.error(t('onboarding.demo_error'));
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleEnableReminder = async () => {
    setIsEnablingReminder(true);
    try {
      await enableReminder();
      toast.success(t('onboarding.reminder_success'));
    } catch {
      toast.error(t('onboarding.error'));
    } finally {
      setIsEnablingReminder(false);
    }
  };

  const handleSkipReminder = async () => {
    try {
      await skipReminder();
    } catch {
      toast.error(t('onboarding.error'));
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      navigate('/');
    } catch {
      toast.error(t('onboarding.error'));
    }
  };

  const progressPercent = 
    (state.step1Done ? 33 : (Math.min(progress.garmentCount, 5) / 5) * 33) +
    (state.step2Done ? 33 : 0) +
    (state.step3Done ? 34 : 0);

  const allDone = state.step1Done && state.step2Done && state.step3Done;

  const steps = [
    { id: 1, titleKey: 'onboarding.step1.title', descKey: 'onboarding.step1.desc', icon: Shirt },
    { id: 2, titleKey: 'onboarding.step2.title', descKey: 'onboarding.step2.desc', icon: Sparkles },
    { id: 3, titleKey: 'onboarding.step3.title', descKey: 'onboarding.step3.desc', icon: Bell },
  ];

  // Redirect if onboarding already completed
  const prefs = profile?.preferences as Record<string, any> | null;
  const onboardingCompleted = prefs?.onboarding?.completed === true;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (onboardingCompleted) {
    return <Navigate to="/" replace />;
  }

  // Step 0: Language picker
  if (!languageStepDone) {
    return <LanguageStep onComplete={() => setLanguageStepDone(true)} />;
  }

  // Step 0.5: Accent color picker
  if (!accentStepDone) {
    return <AccentColorStep onComplete={() => setAccentStepDone(true)} />;
  }

  // Step 1: Body measurements
  if (!bodyStepDone) {
    return (
      <BodyMeasurementsStep
        onComplete={handleSaveBodyMeasurements}
        onSkip={() => setBodyStepDone(true)}
        isSaving={isSavingBody}
      />
    );
  }

  // Step 1.5: Style preferences
  if (!styleStepDone) {
    return (
      <StylePreferencesStep
        onComplete={async (prefs: StylePreferences) => {
          setIsSavingStyle(true);
          try {
            const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
            await updateProfile.mutateAsync({
              preferences: {
                ...currentPrefs,
                favoriteColors: prefs.favoriteColors,
                dislikedColors: prefs.dislikedColors,
                fitPreference: prefs.fitPreference,
                styleVibe: prefs.styleVibe,
                genderNeutral: prefs.genderNeutral,
              },
            });
            setStyleStepDone(true);
          } catch {
            toast.error(t('onboarding.error'));
          } finally {
            setIsSavingStyle(false);
          }
        }}
        isSaving={isSavingStyle}
      />
    );
  }
  // Step 2: App tutorial
  if (!tutorialDone) {
    return <AppTutorialStep onComplete={() => setTutorialDone(true)} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-accent/10 via-accent/5 to-background pt-16 pb-8 px-6 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center mb-6">
          <Sparkles className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold mb-3 tracking-tight">{t('onboarding.welcome')}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{t('onboarding.welcome_sub')}</p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('onboarding.progress')}</span>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isDone = 
                step.id === 1 ? state.step1Done :
                step.id === 2 ? state.step2Done :
                state.step3Done;
              const Icon = step.icon;

              return (
                <Card 
                  key={step.id}
                  className={cn(
                    'transition-all',
                    isActive && 'ring-2 ring-accent shadow-md',
                    isDone && 'bg-accent/5 border-accent/30'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                        isDone ? 'bg-accent text-accent-foreground' : 'bg-secondary'
                      )}>
                        {isDone ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{t(step.titleKey)}</h3>
                          {isDone && <Badge variant="secondary" className="text-xs">{t('onboarding.done_badge')}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{t(step.descKey)}</p>

                        {/* Step 1 content */}
                        {step.id === 1 && !isDone && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={progress.garmentCount >= 5 ? 'default' : 'outline'}>
                                {Math.min(progress.garmentCount, 5)}/5 {t('onboarding.step1.garments')}
                              </Badge>
                              <Badge variant={progress.hasTop ? 'default' : 'outline'}>
                                {progress.hasTop ? '✓' : '○'} {t('onboarding.step1.top')}
                              </Badge>
                              <Badge variant={progress.hasBottom ? 'default' : 'outline'}>
                                {progress.hasBottom ? '✓' : '○'} {t('onboarding.step1.bottom')}
                              </Badge>
                              <Badge variant={progress.hasShoes ? 'default' : 'outline'}>
                                {progress.hasShoes ? '✓' : '○'} {t('onboarding.step1.shoes')}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => navigate('/wardrobe/add')}>
                                <Shirt className="w-4 h-4 mr-1" />
                                {t('onboarding.step1.add')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCreateDemo} disabled={isCreatingDemo}>
                                {isCreatingDemo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
                                {t('onboarding.step1.demo')}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                              {t('onboarding.step1.tip')}
                            </p>
                          </div>
                        )}

                        {/* Step 2 content */}
                        {step.id === 2 && !isDone && state.step1Done && (
                          <div className="space-y-3">
                            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => navigate('/')}>
                              <Sparkles className="w-4 h-4 mr-1" />
                              {t('onboarding.step2.create')}
                            </Button>
                            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                              {t('onboarding.step2.tip')}
                            </p>
                          </div>
                        )}

                        {/* Step 3 content */}
                        {step.id === 3 && !isDone && state.step2Done && (
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleEnableReminder} disabled={isEnablingReminder}>
                                {isEnablingReminder ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Bell className="w-4 h-4 mr-1" />}
                                {t('onboarding.step3.enable')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleSkipReminder}>
                                {t('onboarding.step3.skip')}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                              {t('onboarding.step3.tip')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Completion */}
          {allDone && (
            <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">{t('onboarding.complete.title')}</h2>
                <p className="text-muted-foreground mb-4">{t('onboarding.complete.desc')}</p>
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 h-14 w-full text-base" onClick={handleComplete}>
                  {t('onboarding.complete.cta')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Skip link */}
          {!allDone && (
            <div className="text-center">
              <Button variant="link" onClick={handleComplete} className="text-muted-foreground">
                {t('onboarding.skip_all')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
