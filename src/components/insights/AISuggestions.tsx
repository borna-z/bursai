import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Lock,
  Shirt,
  ChevronRight,
  Wand2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useAISuggestions, type AISuggestion } from '@/hooks/useAISuggestions';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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
    <div className="py-14 space-y-5">
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
      <div className="space-y-1.5 px-8">
        <Progress value={progress} className="h-1.5" />
        <p className="text-[10px] text-center text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

/* ── Garment circle stack ── */
function GarmentStack({ garments }: { garments: AISuggestion['garments'] }) {
  const visible = garments.slice(0, 4);
  const remaining = garments.length - 4;

  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center -space-x-3">
        {visible.map((garment, i) => (
          <motion.div
            key={garment.id}
            initial={{ opacity: 0, scale: 0.7, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-background shadow-md"
            style={{ zIndex: visible.length - i }}
          >
            <LazyImageSimple
              imagePath={garment.image_path}
              alt={garment.title}
              className="w-full h-full object-cover"
              fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/40" />}
            />
          </motion.div>
        ))}
        {remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: visible.length * 0.08, duration: 0.35 }}
            className="relative w-14 h-14 rounded-full bg-muted/40 border-2 border-background flex items-center justify-center shadow-md"
          >
            <span className="text-xs font-semibold text-muted-foreground">+{remaining}</span>
          </motion.div>
        )}
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
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-1"
    >
      {/* Occasion label */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {suggestion.occasion}
      </p>

      {/* Title */}
      <h3 className="text-lg font-semibold leading-snug tracking-tight">
        {suggestion.title}
      </h3>

      {/* Explanation — always visible */}
      <p className="text-[13px] text-muted-foreground leading-relaxed italic line-clamp-2">
        {suggestion.explanation}
      </p>

      {/* Garment circle stack */}
      <GarmentStack garments={suggestion.garments} />

      {/* CTA row */}
      <div className="flex items-center gap-2.5 pt-1">
        <Button
          onClick={onTryIt}
          disabled={isCreating}
          className="flex-1 h-11 text-sm font-semibold"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {t('insights.try')}
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={onPlan}
          className="h-11 px-4 text-sm text-muted-foreground"
        >
          <Calendar className="w-4 h-4 mr-1.5" />
          {t('plan.plan')}
        </Button>
      </div>
    </motion.div>
  );
}

/* ── Dot navigation ── */
function DotNav({ total, active, onChange }: { total: number; active: number; onChange: (i: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 pt-4">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300",
            i === active ? "bg-foreground w-4" : "bg-foreground/20 hover:bg-foreground/40"
          )}
          aria-label={`Suggestion ${i + 1}`}
        />
      ))}
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

  /* ── Premium gate ── */
  if (!isPremium) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="py-10 px-6 blur-sm select-none pointer-events-none">
          <div className="space-y-4">
            <div className="h-3 bg-muted rounded w-1/3" />
            <div className="h-5 bg-muted rounded w-2/3" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="flex justify-center -space-x-3 py-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="w-14 h-14 rounded-full bg-muted border-2 border-background" />
              ))}
            </div>
            <div className="h-11 bg-muted rounded-xl" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
          <div className="text-center p-4">
            <Lock className="w-7 h-7 mx-auto mb-2.5 text-muted-foreground" />
            <p className="font-semibold text-sm">{t('common.premium')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/settings')}>
              {t('insights.unlock')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/[0.04] to-transparent border border-border/10 py-7 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {t('insights.ai_title')}
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-foreground/[0.05] transition-all"
          aria-label="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", isFetching && "animate-spin")} />
        </button>
      </div>

      {/* Body */}
      {(isLoading || isFetching) ? (
        <LoadingIndicator />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-3">{t('insights.load_error')}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3 mr-1.5" />{t('generate.retry')}
          </Button>
        </div>
      ) : !suggestions?.length ? (
        <div className="text-center py-12">
          <Shirt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('insights.add_more_garments')}</p>
        </div>
      ) : (
        <>
          <HeroSlide
            key={activeIndex}
            suggestion={suggestions[activeIndex]}
            onTryIt={() => handleTryIt(suggestions[activeIndex], activeIndex)}
            onPlan={() => handlePlan(suggestions[activeIndex])}
            isCreating={creatingOutfitId === activeIndex}
          />
          <DotNav total={total} active={activeIndex} onChange={setActiveIndex} />
        </>
      )}
    </div>
  );
}
