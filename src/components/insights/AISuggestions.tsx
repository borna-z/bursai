import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lock,
  Shirt,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Wand2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

/* ── Loading indicator ── */
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
      setProgress(Math.min((elapsed / totalDuration) * 100, 95));
    }, 100);

    let stepTimeout: ReturnType<typeof setTimeout>;
    const updateStep = (i: number) => {
      if (i < LOADING_STEPS.length) {
        setCurrentStep(i);
        stepTimeout = setTimeout(() => updateStep(i + 1), LOADING_STEPS[i].duration);
      }
    };
    updateStep(0);

    return () => { clearInterval(progressInterval); clearTimeout(stepTimeout); };
  }, []);

  return (
    <div className="py-10 space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-6 h-6 text-muted-foreground animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center">
            <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />
          </div>
        </div>
        <div className="text-center space-y-0.5">
          <p className="font-medium text-sm">{LOADING_STEPS[currentStep]?.text}</p>
          <p className="text-xs text-muted-foreground">{t('insights.loading.working')}</p>
        </div>
      </div>
      <div className="space-y-1.5 px-6">
        <Progress value={progress} className="h-1.5" />
        <p className="text-[10px] text-center text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

/* ── Single hero suggestion slide ── */
interface HeroSlideProps {
  suggestion: AISuggestion;
  onTryIt: () => void;
  onPlan: () => void;
  isCreating: boolean;
}

function HeroSlide({ suggestion, onTryIt, onPlan, isCreating }: HeroSlideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight">{suggestion.title}</h3>
          <Badge variant="secondary" className="mt-1.5 text-[10px]">
            {suggestion.occasion}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPlan}
          className="h-8 w-8 flex-shrink-0"
        >
          <Calendar className="w-4 h-4" />
        </Button>
      </div>

      {/* Garment grid — larger thumbnails */}
      <div className="grid grid-cols-5 gap-2">
        {suggestion.garments.slice(0, 5).map((garment) => (
          <div key={garment.id} className="aspect-square rounded-xl overflow-hidden border border-border/30 bg-muted/20">
            <LazyImageSimple
              imagePath={garment.image_path}
              alt={garment.title}
              className="w-full h-full object-cover"
              fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/40" />}
            />
          </div>
        ))}
        {suggestion.garments.length > 5 && (
          <div className="aspect-square rounded-xl bg-muted/30 flex items-center justify-center text-xs font-medium text-muted-foreground">
            +{suggestion.garments.length - 5}
          </div>
        )}
      </div>

      {/* Primary CTA */}
      <Button
        onClick={onTryIt}
        disabled={isCreating}
        className="w-full h-11 text-sm font-semibold"
      >
        {isCreating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {t('insights.try')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </>
        )}
      </Button>

      {/* Why this works */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
            <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            {isOpen ? t('insights.hide') : t('insights.why_works')}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <p className="text-[13px] text-muted-foreground leading-relaxed bg-foreground/[0.02] p-3 rounded-xl">
            {suggestion.explanation}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ── Main component ── */
interface AISuggestionsProps {
  isPremium: boolean;
}

export function AISuggestions({ isPremium }: AISuggestionsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [creatingOutfitId, setCreatingOutfitId] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
      const outfitItems = suggestion.garments.map((g) => ({ outfit_id: outfit.id, garment_id: g.id, slot: categoryToSlot[g.category] || g.category }));
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

  const total = suggestions?.length || 0;
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < total - 1;

  /* ── Premium gate ── */
  if (!isPremium) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6 pb-6 blur-sm select-none">
          <div className="space-y-3">
            <div className="h-5 bg-muted rounded w-2/3" />
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="aspect-square bg-muted rounded-xl" />
              ))}
            </div>
            <div className="h-11 bg-muted rounded-xl" />
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
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[13px] font-semibold">{t('insights.ai_title')}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Navigation arrows */}
          {total > 1 && (
            <>
              <button
                onClick={() => canPrev && setActiveIndex(i => i - 1)}
                disabled={!canPrev}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-foreground/[0.05] disabled:opacity-20 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums min-w-[24px] text-center">
                {activeIndex + 1}/{total}
              </span>
              <button
                onClick={() => canNext && setActiveIndex(i => i + 1)}
                disabled={!canNext}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-foreground/[0.05] disabled:opacity-20 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-foreground/[0.05] transition-all ml-1"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Body */}
      <CardContent className="pt-2 pb-5">
        {(isLoading || isFetching) ? (
          <LoadingIndicator />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">{t('insights.load_error')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3 mr-1.5" />{t('generate.retry')}
            </Button>
          </div>
        ) : !suggestions?.length ? (
          <div className="text-center py-8">
            <Shirt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('insights.add_more_garments')}</p>
          </div>
        ) : (
          <HeroSlide
            key={activeIndex}
            suggestion={suggestions[activeIndex]}
            onTryIt={() => handleTryIt(suggestions[activeIndex], activeIndex)}
            onPlan={() => handlePlan(suggestions[activeIndex])}
            isCreating={creatingOutfitId === activeIndex}
          />
        )}
      </CardContent>
    </Card>
  );
}
