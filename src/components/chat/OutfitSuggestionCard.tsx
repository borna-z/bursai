import { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Shirt, Plus, Lock, Bookmark, BookmarkCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE } from '@/lib/motion';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

const SHOE_CATEGORIES = new Set([
  'shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels',
  'skor', 'stövlar', 'footwear', 'trainers', 'oxfords', 'mules',
]);

function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
  );
}

const NEUTRAL = ['black', 'white', 'grey', 'beige', 'navy', 'svart', 'vit', 'grå', 'marinblå', 'marin'];

function scoreCandidate(g: GarmentBasic, otherColors: string[]): number {
  let s = 5;
  const c = g.color_primary?.toLowerCase() || '';
  if (NEUTRAL.includes(c)) s += 2;
  else if (otherColors.some(oc => !NEUTRAL.includes(oc) && oc !== c)) s -= 2;
  return s;
}

interface OutfitSuggestionCardProps {
  garments: GarmentBasic[];
  explanation: string;
  onTryOutfit: (garmentIds: string[]) => void;
  isCreating?: boolean;
  isRefining?: boolean;
  lockedSlots?: string[];
  onRefine?: (garmentIds: string[], explanation: string) => void;
  onSave?: (garmentIds: string[]) => void;
  onToggleLock?: (garmentId: string) => void;
  isSaving?: boolean;
  isSaved?: boolean;
  changedGarmentIds?: string[];
  historyMode?: boolean;
  hideTryButton?: boolean;
}

export function OutfitSuggestionCard({
  garments: initialGarments,
  explanation,
  onTryOutfit,
  isCreating,
  isRefining,
  lockedSlots,
  onRefine,
  onSave,
  onToggleLock,
  isSaving,
  isSaved,
  changedGarmentIds,
  historyMode = false,
  hideTryButton = false,
}: OutfitSuggestionCardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [garments, setGarments] = useState(initialGarments);
  const [swapOpen, setSwapOpen] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<GarmentBasic[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [localSaved, setLocalSaved] = useState(false);

  // Sync local garments when props change (e.g., after refine response)
  useEffect(() => {
    const propIds = initialGarments.map(g => g.id).join(',');
    const localIds = garments.map(g => g.id).join(',');
    if (propIds !== localIds) {
      setGarments(initialGarments);
      setLocalSaved(false);
    }
  }, [initialGarments]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (changedGarmentIds && changedGarmentIds.length > 0) {
      setHighlightIds(new Set(changedGarmentIds));
      const timer = setTimeout(() => setHighlightIds(new Set()), 800);
      return () => clearTimeout(timer);
    }
  }, [changedGarmentIds]);

  const missingShoes = useMemo(
    () => garments.length >= 2 && !garments.some(g => SHOE_CATEGORIES.has(g.category?.toLowerCase() ?? '')),
    [garments],
  );

  const fetchAlternatives = useCallback(async (index: number) => {
    if (!user) return;
    const current = garments[index];
    setSwapOpen(index);
    setLoadingAlts(true);
    setAlternatives([]);

    try {
      const { data } = await supabase
        .from('garments')
        .select('id, title, category, color_primary, image_path, original_image_path, rendered_image_path, render_status')
        .eq('user_id', user.id)
        .eq('category', current.category)
        .neq('id', current.id)
        .limit(20);

      if (!data?.length) { setAlternatives([]); return; }

      const otherColors = garments
        .filter((_, i) => i !== index)
        .map(g => g.color_primary?.toLowerCase() || '');

      const scored = data
        .map(g => ({ g, score: scoreCandidate(g, otherColors) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map(x => x.g);

      setAlternatives(scored);
    } catch { setAlternatives([]); }
    finally { setLoadingAlts(false); }
  }, [user, garments]);

  const handleSwap = (index: number, newGarment: GarmentBasic) => {
    setGarments(prev => prev.map((g, i) => i === index ? newGarment : g));
    setSwapOpen(null);
  };

  const lockedSet = useMemo(() => new Set(lockedSlots ?? []), [lockedSlots]);
  const saved = isSaved || localSaved;

  return (
    <motion.div
      layout
      className={`rounded-[1.25rem] border bg-card overflow-hidden shadow-sm transition-colors duration-300 ${
        isRefining
          ? 'border-accent/50 shadow-[0_0_0_1px_hsl(37_47%_46%/0.12),0_2px_12px_hsl(37_47%_46%/0.08)]'
          : historyMode
            ? 'border-border/35 shadow-none'
            : 'border-border/60'
      }`}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.35 }}
    >
      {/* Garment grid */}
      <div className="grid grid-cols-4 gap-2.5 p-3.5">
        {garments.map((g, i) => {
          const isLocked = lockedSet.has(g.id);
          const isHighlighted = highlightIds.has(g.id);
          return (
            <div key={g.id} className="group relative min-w-0">
              {/* Image */}
              <div
                className="relative cursor-pointer"
                onClick={isRefining ? (e) => {
                  e.preventDefault();
                  hapticLight();
                  onToggleLock?.(g.id);
                } : undefined}
              >
                <Link
                  to={`/wardrobe/${g.id}`}
                  className={isRefining ? 'pointer-events-none' : 'block'}
                  onClick={isRefining ? (e) => e.preventDefault() : undefined}
                >
                  <motion.div
                    layout
                    className={`mx-auto aspect-square w-full max-w-[76px] overflow-hidden rounded-[1rem] border bg-muted/40 transition-all duration-300 ${
                      isLocked
                        ? 'border-accent/70 ring-[1.5px] ring-accent/40'
                        : isHighlighted
                          ? 'border-accent ring-[1.5px] ring-accent/30'
                          : 'border-border/30'
                    }`}
                  >
                    <LazyImageSimple
                      imagePath={getPreferredGarmentImagePath(g)}
                      alt={g.title}
                      className="w-full h-full object-cover"
                      fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/40" />}
                    />
                  </motion.div>
                </Link>

                {/* Lock badge — sits on bottom-right of image */}
                <AnimatePresence>
                  {isRefining && isLocked && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-accent flex items-center justify-center shadow-sm"
                    >
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Title */}
              <p className="mx-auto mt-1.5 max-w-[76px] truncate text-center text-[10.5px] font-body text-muted-foreground/70">
                {g.title}
              </p>

              {/* Swap button — hidden in refine mode */}
              {!isRefining && !historyMode && <Popover open={swapOpen === i} onOpenChange={(open) => {
                if (open) fetchAlternatives(i);
                else setSwapOpen(null);
              }}>
                <PopoverTrigger asChild>
                  <button className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-card border border-border/40 shadow-sm flex items-center justify-center hover:bg-muted active:scale-90 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label="Swap garment"> {/* i18n-ignore */}
                    <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2 space-y-1.5" side="bottom" align="center">
                  {loadingAlts ? (
                    <div className="flex items-center justify-center py-3 px-4">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  ) : alternatives.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-1 py-2">{t('outfit.no_alternatives')}</p>
                  ) : (
                    <div className="flex gap-1.5">
                      {alternatives.map(alt => (
                        <button
                          key={alt.id}
                          onClick={() => handleSwap(i, alt)}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border/40">
                            <LazyImageSimple
                              imagePath={getPreferredGarmentImagePath(alt)}
                              alt={alt.title}
                              className="w-full h-full object-cover"
                              fallbackIcon={<Shirt className="w-3 h-3" />}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground truncate w-12 text-center">{alt.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>}
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      <div className="px-4 pb-2.5">
        <p className={`text-[13px] font-body text-muted-foreground/80 leading-[1.6] ${historyMode ? 'line-clamp-2' : 'line-clamp-3'}`}>
          {renderBoldMarkdown(explanation)}
        </p>
      </div>

      {/* Missing shoes */}
      {missingShoes && (
        <div className="mx-3.5 mb-2.5 flex items-center gap-2 rounded-[1rem] bg-amber-500/8 border border-amber-500/15 px-3 py-2">
          <Shirt className="w-3.5 h-3.5 text-amber-600/70 shrink-0" />
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 leading-snug font-body">
            {t('outfit.missing_shoes')}
          </p>
          <button
            onClick={() => navigate('/wardrobe?scan=shoes')}
            className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline"
          >
            <Plus className="w-3 h-3" />
            {t('outfit.add_shoes')}
          </button>
        </div>
      )}

      {/* Actions — clean two-button row */}
      <AnimatePresence mode="wait">
        {!isRefining && !historyMode && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">
              {missingShoes ? (
                <div className="space-y-1.5">
                  <Button
                    size="sm"
                    className="w-full rounded-full text-[13px] h-11 gap-1.5"
                    onClick={() => navigate('/wardrobe?scan=shoes')}
                    disabled={isCreating}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('outfit.add_shoes')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full rounded-full text-[13px] h-10 gap-1.5 text-muted-foreground"
                    onClick={() => onTryOutfit(garments.map(g => g.id))}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      t('outfit.save_without_shoes')
                    )}
                  </Button>
                </div>
              ) : onRefine && onSave ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full text-[13px] h-10 gap-1.5 border-border/40 text-foreground/70 hover:text-foreground hover:bg-muted/50 hover:border-border/60"
                    onClick={() => { hapticLight(); onRefine(garments.map(g => g.id), explanation); }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {t('chat.refine')}
                  </Button>
                  <Button
                    size="sm"
                    className={`flex-1 rounded-full text-[13px] h-10 gap-1.5 transition-all ${
                      saved
                        ? 'bg-accent/10 text-accent border border-accent/30 hover:bg-accent/15'
                        : ''
                    }`}
                    variant={saved ? 'outline' : 'default'}
                    onClick={() => {
                      if (!saved) {
                        hapticLight();
                        onSave(garments.map(g => g.id));
                        setLocalSaved(true);
                      }
                    }}
                    disabled={isSaving || saved}
                  >
                    {isSaving ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : saved ? (
                      <>
                        <BookmarkCheck className="w-3 h-3" />
                        {t('chat.saved')}
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3 h-3" />
                        {t('chat.save')}
                      </>
                    )}
                  </Button>
                </div>
              ) : hideTryButton ? null : (
                <Button
                  size="sm"
                  className="w-full rounded-full text-[13px] h-10 gap-1.5"
                  onClick={() => onTryOutfit(garments.map(g => g.id))}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    t('outfit.try_this')
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refine mode hint */}
      <AnimatePresence>
        {isRefining && !historyMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3 pt-0.5">
              <p className="text-[11px] font-body text-accent/70 text-center tracking-wide">
                {t('chat.tap_to_lock') || 'Tap garments to lock them'} {/* i18n-ignore */}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
