import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AILoadingOverlay } from '@/components/ui/AILoadingOverlay';
import { logger } from '@/lib/logger';
import { StaleIndicator } from '@/components/ui/StaleIndicator';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useAISuggestions, type AISuggestion, type AISuggestionsEmptyState } from '@/hooks/useAISuggestions';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { inferOutfitSlotFromGarment, validateCompleteOutfit } from '@/lib/outfitValidation';

/* ── Loading indicator ── */
function LoadingIndicator() {
  const { t } = useLanguage();

  const LOADING_STEPS = useMemo(() => [
    { icon: Wand2, text: t('insights.loading.analyzing'), duration: 1500 },
    { icon: Eye, text: t('insights.loading.identifying'), duration: 1500 },
    { icon: Shirt, text: t('insights.loading.matching'), duration: 1500 },
    { icon: Sparkles, text: t('insights.loading.creating'), duration: 2000 },
    { icon: Wand2, text: t('insights.loading.almost'), duration: 3000 },
  ], [t]);

  const [, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef(Date.now());

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
  }, [LOADING_STEPS]);

  return (
    <div className="py-14">
      <AILoadingOverlay
        variant="card"
        phases={LOADING_STEPS.map(s => ({ icon: s.icon, label: s.text, duration: s.duration }))}
        progress={progress}
      />
    </div>
  );
}

/* ── Horizontal garment row (no overlap) ── */
function GarmentRow({ garments }: { garments: AISuggestion['garments'] }) {
  return (
    <div className="grid grid-cols-4 gap-3 px-1 sm:grid-cols-5">
      {garments.map((garment, i) => (
        <motion.div
          key={garment.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.07, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex min-w-0 flex-col items-center gap-1.5"
        >
          <div className="aspect-square w-full max-w-[72px] overflow-hidden rounded-full border border-border/30 bg-muted">
            <LazyImageSimple
              imagePath={getPreferredGarmentImagePath(garment)}
              alt={garment.title}
              className="h-full w-full object-cover"
              fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
            />
          </div>
          <span className="line-clamp-2 text-center text-[9px] font-medium capitalize text-muted-foreground/70">
            {garment.category}
          </span>
        </motion.div>
      ))}
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
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-4"
    >
      {/* Occasion + Title */}
      <div className="text-center space-y-1.5 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
          {suggestion.occasion}
        </p>
        <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
          {suggestion.title}
        </h3>
      </div>

      {/* Garment row — horizontal, no overlap */}
      <GarmentRow garments={suggestion.garments} />

      {/* Explanation */}
      <p className="text-[12px] text-muted-foreground/60 leading-relaxed text-center italic line-clamp-2 px-1">
        {suggestion.explanation}
      </p>

      {/* CTA row */}
      <div className="flex items-center gap-2.5 pt-1">
         <Button
            onClick={onTryIt}
            disabled={isCreating}
            size="sm"
            className="flex-1 h-10 text-xs font-semibold"
        >
          {isCreating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              {t('insights.try')}
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </>
          )}
        </Button>
         <Button
           variant="ghost"
           size="sm"
           onClick={onPlan}
           className="h-10 px-3 text-xs text-muted-foreground"
        >
          <Calendar className="w-3.5 h-3.5 mr-1" />
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
    <div className="flex items-center justify-center gap-1.5 pt-5">
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


function getEmptyStateCopy(emptyState: AISuggestionsEmptyState | null, t: (key: string) => string) {
  if (!emptyState) return t('insights.add_more_garments');
  if (emptyState.reason === 'not_enough_garments') return t('insights.add_more_garments');

  const missing = new Set(emptyState.missingSlots);
  if (missing.has('outerwear') && missing.size === 1) return 'Add outerwear for this weather to unlock AI suggestions.';
  if (missing.has('shoes') && missing.size === 1) return 'Add shoes to unlock complete AI outfit suggestions.';
  if (missing.has('bottom') && missing.size === 1) return 'Add a bottom to unlock complete AI outfit suggestions.';
  if (missing.has('top') && missing.size === 1) return 'Add a top to unlock complete AI outfit suggestions.';
  if (missing.has('dress') && missing.size === 1) return 'Add a dress or a top-and-bottom combo to unlock AI suggestions.';
  if (missing.has('shoes') && missing.has('bottom')) return 'Add both shoes and a bottom before Home can show complete AI outfits.';
  if (missing.has('outerwear')) return 'Your wardrobe is close, but this weather still needs outerwear for complete AI outfits.';
  return t('insights.add_more_garments');
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

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useAISuggestions();
  const suggestions = data?.suggestions;
  const emptyState = data?.emptyState;

  const handleTryIt = async (suggestion: AISuggestion, index: number) => {
    if (!user) return;
    setCreatingOutfitId(index);
    try {
      const baseValidation = validateCompleteOutfit(suggestion.garments.map((garment) => ({ garment })));
      if (!baseValidation.isValid) {
        throw new Error(`Refusing to persist invalid outfit suggestion. Missing: ${baseValidation.missing.join(', ')}`);
      }

      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({ user_id: user.id, occasion: suggestion.occasion, explanation: suggestion.explanation, style_vibe: suggestion.title, saved: true })
        .select().single();
      if (outfitError) throw outfitError;

      const outfitItems = suggestion.garments.map((garment) => ({
        outfit_id: outfit.id,
        garment_id: garment.id,
        slot: inferOutfitSlotFromGarment(garment),
      }));
      const { error: itemsError } = await supabase.from('outfit_items').insert(outfitItems);
      if (itemsError) throw itemsError;

      toast.success(t('insights.outfit_created'));
      navigate(`/outfits/${outfit.id}`);
    } catch (err) {
      logger.error('Failed to create outfit:', err);
      toast.error(t('insights.create_error'));
    } finally {
      setCreatingOutfitId(null);
    }
  };

  const handlePlan = (suggestion: AISuggestion) => {
    handleTryIt(suggestion, -1);
  };

  const total = suggestions?.length || 0;

  const handleSwipe = useCallback((_: unknown, info: PanInfo) => {
    if (!suggestions?.length) return;
    const threshold = 50;
    if (info.offset.x < -threshold) {
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (info.offset.x > threshold) {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  }, [suggestions]);

  /* ── Premium gate ── */
  if (!isPremium) {
    return (
      <div className="relative rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-primary/[0.04] to-transparent">
        <div className="py-10 px-6 blur-sm select-none pointer-events-none">
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <div className="h-3 bg-muted rounded w-1/3 mx-auto" />
              <div className="h-5 bg-muted rounded w-2/3 mx-auto" />
            </div>
            <div className="flex justify-center gap-3 py-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex flex-col items-center gap-1.5">
                  <div className="w-[88px] h-[88px] rounded-full bg-muted" />
                  <div className="h-2 w-12 bg-muted rounded" />
                </div>
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
    <div className="rounded-[var(--radius,1rem)] surface-hero py-5 px-5">
       {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-[13px] font-semibold text-foreground/80 tracking-tight">
            {t('insights.ai_title')}
          </span>
          <StaleIndicator
            updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null}
            onRefresh={() => refetch()}
            className="ml-1 opacity-60"
          />
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
          <p className="text-sm text-muted-foreground">{getEmptyStateCopy(emptyState ?? null, t)}</p>
        </div>
      ) : (
        <>
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={handleSwipe}
            className="touch-pan-y cursor-grab active:cursor-grabbing"
          >
            <AnimatePresence mode="wait">
              <HeroSlide
                key={activeIndex}
                suggestion={suggestions[activeIndex]}
                onTryIt={() => handleTryIt(suggestions[activeIndex], activeIndex)}
                onPlan={() => handlePlan(suggestions[activeIndex])}
                isCreating={creatingOutfitId === activeIndex}
              />
            </AnimatePresence>
          </motion.div>
          <DotNav total={total} active={activeIndex} onChange={setActiveIndex} />
        </>
      )}
    </div>
  );
}
