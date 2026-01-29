import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Lock,
  Shirt,
  ChevronRight,
  Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAISuggestions, type AISuggestion } from '@/hooks/useAISuggestions';
import { useStorage } from '@/hooks/useStorage';
import { cn } from '@/lib/utils';

const LOADING_STEPS = [
  { text: 'Analyserar din garderob...', duration: 1500 },
  { text: 'Identifierar oanvända plagg...', duration: 1500 },
  { text: 'Matchar färger och stilar...', duration: 1500 },
  { text: 'Skapar personliga förslag...', duration: 2000 },
  { text: 'Nästan klar...', duration: 3000 },
];

function LoadingIndicator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // Calculate total duration for progress
    const totalDuration = LOADING_STEPS.reduce((sum, step) => sum + step.duration, 0);
    
    // Update progress smoothly
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(newProgress);
    }, 100);

    // Update step text
    let stepTimeout: NodeJS.Timeout;
    const updateStep = (stepIndex: number) => {
      if (stepIndex < LOADING_STEPS.length) {
        setCurrentStep(stepIndex);
        stepTimeout = setTimeout(() => {
          updateStep(stepIndex + 1);
        }, LOADING_STEPS[stepIndex].duration);
      }
    };
    updateStep(0);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
    };
  }, []);

  return (
    <div className="py-8 space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
          </div>
        </div>
        
        <div className="text-center space-y-1">
          <p className="font-medium text-sm">{LOADING_STEPS[currentStep]?.text}</p>
          <p className="text-xs text-muted-foreground">
            Din personliga stylist arbetar
          </p>
        </div>
      </div>
      
      <div className="space-y-2 px-4">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">
          {Math.round(progress)}%
        </p>
      </div>
      
      {/* Animated dots */}
      <div className="flex justify-center gap-1.5 pt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface GarmentPreviewProps {
  garment: AISuggestion['garments'][0];
}

function GarmentPreview({ garment }: GarmentPreviewProps) {
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // We need the full image_path to get signed URL
    // For now, show placeholder with color
  }, []);

  return (
    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 shadow-sm border border-border/50">
      <Shirt className="w-5 h-5 text-muted-foreground/60" />
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onTryIt: () => void;
}

function SuggestionCard({ suggestion, onTryIt }: SuggestionCardProps) {
  return (
    <div className="p-4 bg-muted/30 rounded-xl space-y-3 border border-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{suggestion.title}</h4>
          <Badge variant="secondary" className="mt-1 text-xs">
            {suggestion.occasion}
          </Badge>
        </div>
        <Button 
          size="sm" 
          variant="secondary"
          onClick={onTryIt}
          className="flex-shrink-0"
        >
          Prova
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground line-clamp-2">
        {suggestion.explanation}
      </p>
      
      <div className="flex gap-2 overflow-x-auto pb-1">
        {suggestion.garments.map((garment) => (
          <div key={garment.id} className="flex-shrink-0">
            <GarmentPreview garment={garment} />
          </div>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {suggestion.garments.map((garment) => (
          <span 
            key={garment.id}
            className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full"
          >
            {garment.title}
          </span>
        ))}
      </div>
    </div>
  );
}

interface AISuggestionsProps {
  isPremium: boolean;
}

export function AISuggestions({ isPremium }: AISuggestionsProps) {
  const navigate = useNavigate();
  const { 
    data: suggestions, 
    isLoading, 
    error, 
    refetch, 
    isFetching 
  } = useAISuggestions();

  const handleTryIt = (suggestion: AISuggestion) => {
    // Navigate to outfit generator with pre-selected context
    // For now, just go to home to generate new outfit
    navigate('/');
  };

  if (!isPremium) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">AI-förslag</CardTitle>
          </div>
          <CardDescription>
            Personliga outfit-kombinationer baserat på din stil
          </CardDescription>
        </CardHeader>
        <CardContent className="blur-sm select-none">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="flex gap-2">
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                  <div className="w-12 h-12 bg-muted rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">Premium-funktion</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => navigate('/settings')}
            >
              Lås upp
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">AI-förslag</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8"
          >
            <RefreshCw className={cn(
              "w-4 h-4",
              isFetching && "animate-spin"
            )} />
          </Button>
        </div>
        <CardDescription>
          Prova dessa kombinationer med dina oanvända plagg
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(isLoading || isFetching) ? (
          <LoadingIndicator />
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              Kunde inte ladda förslag just nu
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Försök igen
            </Button>
          </div>
        ) : !suggestions?.length ? (
          <div className="text-center py-6">
            <Shirt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Lägg till fler plagg för att få AI-förslag
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard 
                key={index}
                suggestion={suggestion}
                onTryIt={() => handleTryIt(suggestion)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
