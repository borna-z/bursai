import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useUpdateProfile } from '@/hooks/useProfile';
import { BodyMeasurementsStep } from '@/components/onboarding/BodyMeasurementsStep';
import { toast } from 'sonner';

const steps = [
  {
    id: 1,
    title: 'Bygg din garderob',
    description: 'Lägg till 5 plagg (minst 1 överdel, 1 underdel, 1 par skor)',
    icon: Shirt,
  },
  {
    id: 2,
    title: 'Skapa din första outfit',
    description: 'Låt appen föreslå en outfit baserat på dina plagg',
    icon: Sparkles,
  },
  {
    id: 3,
    title: 'Daglig påminnelse',
    description: 'Få inspiration varje morgon (valfritt)',
    icon: Bell,
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
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
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [isEnablingReminder, setIsEnablingReminder] = useState(false);
  // steg 0: kroppsmått – visas tills användaren slutfört eller hoppat
  const [bodyStepDone, setBodyStepDone] = useState(false);
  const [isSavingBody, setIsSavingBody] = useState(false);

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
      toast.error('Kunde inte spara. Försök igen.');
    } finally {
      setIsSavingBody(false);
    }
  };

  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    try {
      await createDemoGarments();
      toast.success('6 exempelplagg tillagda!', {
        description: 'Nu kan du testa att skapa outfits',
      });
    } catch (error) {
      toast.error('Kunde inte skapa exempelplagg');
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleEnableReminder = async () => {
    setIsEnablingReminder(true);
    try {
      await enableReminder();
      toast.success('Daglig påminnelse aktiverad!');
    } catch {
      toast.error('Något gick fel');
    } finally {
      setIsEnablingReminder(false);
    }
  };

  const handleSkipReminder = async () => {
    try {
      await skipReminder();
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboarding();
      navigate('/');
    } catch {
      toast.error('Något gick fel');
    }
  };

  // Calculate overall progress percentage
  const progressPercent = 
    (state.step1Done ? 33 : (Math.min(progress.garmentCount, 5) / 5) * 33) +
    (state.step2Done ? 33 : 0) +
    (state.step3Done ? 34 : 0);

  // Check if all steps are done
  const allDone = state.step1Done && state.step2Done && state.step3Done;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Steg 0: Kroppsmått – visas direkt när onboarding startar
  if (!bodyStepDone) {
    return (
      <BodyMeasurementsStep
        onComplete={handleSaveBodyMeasurements}
        onSkip={() => setBodyStepDone(true)}
        isSaving={isSavingBody}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="text-center mb-8 pt-8">
        <h1 className="text-3xl font-bold mb-2">Välkommen! 👋</h1>
        <p className="text-muted-foreground">
          Låt oss komma igång med din digitala garderob
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Din framgång</span>
          <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-3" />
      </div>

      {/* Steps */}
      <div className="space-y-4 mb-8">
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
                isActive && 'ring-2 ring-primary shadow-md',
                isDone && 'bg-primary/5 border-primary/30'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
                    isDone ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                  )}>
                    {isDone ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{step.title}</h3>
                      {isDone && (
                        <Badge variant="secondary" className="text-xs">Klart!</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {step.description}
                    </p>

                    {/* Step-specific content */}
                    {step.id === 1 && !isDone && (
                      <div className="space-y-3">
                        {/* Progress indicators */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={progress.garmentCount >= 5 ? 'default' : 'outline'}>
                            {Math.min(progress.garmentCount, 5)}/5 plagg
                          </Badge>
                          <Badge variant={progress.hasTop ? 'default' : 'outline'}>
                            {progress.hasTop ? '✓' : '○'} Överdel
                          </Badge>
                          <Badge variant={progress.hasBottom ? 'default' : 'outline'}>
                            {progress.hasBottom ? '✓' : '○'} Underdel
                          </Badge>
                          <Badge variant={progress.hasShoes ? 'default' : 'outline'}>
                            {progress.hasShoes ? '✓' : '○'} Skor
                          </Badge>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => navigate('/wardrobe/add')}
                          >
                            <Shirt className="w-4 h-4 mr-1" />
                            Lägg till plagg
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleCreateDemo}
                            disabled={isCreatingDemo}
                          >
                            {isCreatingDemo ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4 mr-1" />
                            )}
                            Demo-läge
                          </Button>
                        </div>
                        
                        {/* Tip */}
                        <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                          💡 Tips: Använd kameran för att snabbt lägga till plagg, AI:n taggar automatiskt!
                        </p>
                      </div>
                    )}

                    {step.id === 2 && !isDone && state.step1Done && (
                      <div className="space-y-3">
                        <Button 
                          size="sm" 
                          onClick={() => navigate('/')}
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Skapa outfit
                        </Button>
                        <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                          💡 Tips: Välj ett tillfälle och väder så matchar appen plagg automatiskt!
                        </p>
                      </div>
                    )}

                    {step.id === 3 && !isDone && state.step2Done && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={handleEnableReminder}
                            disabled={isEnablingReminder}
                          >
                            {isEnablingReminder ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                              <Bell className="w-4 h-4 mr-1" />
                            )}
                            Aktivera påminnelse
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={handleSkipReminder}
                          >
                            Hoppa över
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">
                          💡 Tips: En daglig påminnelse hjälper dig använda hela garderoben!
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
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Du är redo! ✅</h2>
            <p className="text-muted-foreground mb-4">
              Grattis! Nu kan du börja använda din digitala garderob.
            </p>
            <Button size="lg" onClick={handleComplete}>
              Börja använda appen
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Skip link */}
      {!allDone && (
        <div className="text-center mt-8">
          <Button 
            variant="link" 
            onClick={handleComplete}
            className="text-muted-foreground"
          >
            Hoppa över introduktionen
          </Button>
        </div>
      )}
    </div>
  );
}
