import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Lock,
  Shirt,
  ChevronRight,
  ChevronDown,
  Wand2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useAISuggestions, type AISuggestion } from '@/hooks/useAISuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';

function LoadingIndicator() {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());

  const LOADING_STEPS = [
    { text: t('insights.loading.analyzing'), duration: 1500 },
    { text: t('insights.loading.identifying'), duration: 1500 },
    { text: t('insights.loading.matching'), duration: 1500 },
    { text: t('insights.loading.creating'), duration: 2000 },
    { text: t('insights.loading.almost'), duration: 3000 },
  ];

  useEffect(() => {
    const totalDuration = LOADING_STEPS.reduce((sum, step) => sum + step.duration, 0);
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 95);
      setProgress(newProgress);
    }, 100);

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
            <Wand2 className="w-7 h-7 text-muted-foreground animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          </div>
        </div>
        
        <div className="text-center space-y-1">
          <p className="font-medium text-sm">{LOADING_STEPS[currentStep]?.text}</p>
          <p className="text-xs text-muted-foreground">{t('insights.loading.working')}</p>
        </div>
      </div>
      
      <div className="space-y-2 px-4">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onTryIt: () => void;
  onPlan: () => void;
  isCreating: boolean;
}

function SuggestionCard({ suggestion, onTryIt, onPlan, isCreating }: SuggestionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="p-4 bg-muted/30 rounded-xl space-y-3 border border-border/50 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{suggestion.title}</h4>
          <Badge variant="secondary" className="mt-1 text-xs">
            {suggestion.occasion}
          </Badge>
        </div>
        <div className="flex gap-1.5">
          <Button 
            size="sm" 
            variant="outline"
            onClick={onPlan}
            className="h-8 px-2"
          >
            <Calendar className="w-3.5 h-3.5" />
          </Button>
          <Button 
            size="sm" 
            onClick={onTryIt}
            disabled={isCreating}
            className="h-8"
          >
            {isCreating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {t('insights.try')}
                <ChevronRight className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex gap-2 flex-wrap">
        {suggestion.garments.slice(0, 5).map((garment) => (
          <div key={garment.id} className="group relative">
            <LazyImageSimple
              imagePath={garment.image_path}
              alt={garment.title}
              className="w-16 h-16 rounded-lg shadow-sm border border-border/50"
              fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/60" />}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-[10px] text-white truncate">{garment.title}</p>
            </div>
          </div>
        ))}
        {suggestion.garments.length > 5 && (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">
            +{suggestion.garments.length - 5}
          </div>
        )}
      </div>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            {isOpen ? t('insights.hide') : t('insights.why_works')}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <p className="text-sm text-muted-foreground bg-background/50 p-2 rounded-lg">
            {suggestion.explanation}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface AISuggestionsProps {
  isPremium: boolean;
}

export function AISuggestions({ isPremium }: AISuggestionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [creatingOutfitId, setCreatingOutfitId] = useState<number | null>(null);
  
  const { data: suggestions, isLoading, error, refetch, isFetching } = useAISuggestions();

  const handleTryIt = async (suggestion: AISuggestion, index: number) => {
    if (!user) return;
    setCreatingOutfitId(index);
    try {
      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({ user_id: user.id, occasion: suggestion.occasion, explanation: suggestion.explanation, style_vibe: suggestion.title, saved: true })
        .select().single();
      if (outfitError) throw outfitError;

      const categoryToSlot: Record<string, string> = { top: 'top', bottom: 'bottom', shoes: 'shoes', outerwear: 'outerwear', accessory: 'accessory', dress: 'dress', fullbody: 'fullbody' };
      const outfitItems = suggestion.garments.map((garment) => ({ outfit_id: outfit.id, garment_id: garment.id, slot: categoryToSlot[garment.category] || garment.category }));
      const { error: itemsError } = await supabase.from('outfit_items').insert(outfitItems);
      if (itemsError) throw itemsError;

      toast.success(t('insights.outfit_created'));
      navigate(`/outfits/${outfit.id}`);
    } catch (err) {
      console.error('Failed to create outfit:', err);
      toast.error(t('insights.create_error'));
    } finally {
      setCreatingOutfitId(null);
    }
  };

  const handlePlan = (suggestion: AISuggestion) => {
    handleTryIt(suggestion, -1);
  };

  if (!isPremium) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{t('insights.ai_title')}</CardTitle>
          </div>
          <CardDescription>{t('insights.ai_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="blur-sm select-none">
          <div className="space-y-3">
            {[1].map((i) => (
              <div key={i} className="p-4 bg-muted/30 rounded-xl space-y-3">
                <div className="h-5 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (<div key={j} className="w-16 h-16 bg-muted rounded-lg" />))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="text-center p-4">
            <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="font-medium">{t('common.premium')}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/settings')}>
              {t('insights.unlock')}
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
            <CardTitle className="text-base">{t('insights.ai_title')}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching} className="h-8 w-8">
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>{t('insights.ai_try_unused')}</CardDescription>
      </CardHeader>
      <CardContent>
        {(isLoading || isFetching) ? (
          <LoadingIndicator />
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">{t('insights.load_error')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3 mr-1.5" />{t('generate.retry')}
            </Button>
          </div>
        ) : !suggestions?.length ? (
          <div className="text-center py-6">
            <Shirt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('insights.add_more_garments')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.slice(0, 1).map((suggestion, index) => (
              <SuggestionCard 
                key={index}
                suggestion={suggestion}
                onTryIt={() => handleTryIt(suggestion, index)}
                onPlan={() => handlePlan(suggestion)}
                isCreating={creatingOutfitId === index}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
