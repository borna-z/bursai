import { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Shirt, Plus, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

const SHOE_CATEGORIES = new Set([
  'shoes', 'sneakers', 'boots', 'loafers', 'sandals', 'heels',
  'skor', 'stövlar', 'footwear', 'trainers', 'oxfords', 'mules',
]);

function renderBoldMarkdown(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// Simplified swap scoring inline (avoid importing full hook)
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
  // Refine mode props
  isRefining?: boolean;
  lockedSlots?: string[];
  onRefine?: (garmentIds: string[], explanation: string) => void;
  onSave?: (garmentIds: string[]) => void;
  onToggleLock?: (garmentId: string) => void;
  isSaving?: boolean;
  isSaved?: boolean;
  changedGarmentIds?: string[];
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
}: OutfitSuggestionCardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [garments, setGarments] = useState(initialGarments);
  const [swapOpen, setSwapOpen] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<GarmentBasic[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (changedGarmentIds && changedGarmentIds.length > 0) {
      setHighlightIds(new Set(changedGarmentIds));
      const timer = setTimeout(() => setHighlightIds(new Set()), 600);
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
        .select('id, title, category, color_primary, image_path, original_image_path, processed_image_path, image_processing_status, rendered_image_path, render_status')
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

  return (
    <div className={`rounded-[1.25rem] border bg-card overflow-hidden animate-scale-in shadow-sm ${isRefining ? 'border-accent/60 ring-1 ring-accent/20' : 'border-border/80'}`}>
      {/* Garment row */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {garments.map((g, i) => {
          const isLocked = lockedSet.has(g.id);
          const isHighlighted = highlightIds.has(g.id);
          return (
            <div key={g.id} className="group relative min-w-0">
              <Link to={`/wardrobe/${g.id}`} className="block">
                <div className={`mx-auto aspect-square w-full max-w-[72px] overflow-hidden rounded-[1.1rem] border bg-muted transition-all duration-300 ${isLocked ? 'ring-2 ring-accent/60 border-accent/60' : isHighlighted ? 'border-accent ring-2 ring-accent/40' : 'border-border/40'}`}>
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(g)}
                    alt={g.title}
                    className="w-full h-full object-cover"
                    fallbackIcon={<Shirt className="w-5 h-5" />}
                  />
                </div>
              </Link>
              <p className="mx-auto mt-1 max-w-[72px] truncate text-center text-[11px] text-muted-foreground">{g.title}</p>

              {/* Tap-to-lock overlay in refine mode */}
              {isRefining && (
                <button
                  className="absolute inset-0 flex items-start justify-start p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hapticLight();
                    onToggleLock?.(g.id);
                  }}
                  aria-label={isLocked ? 'Unlock garment' : 'Lock garment'} // i18n-ignore
                >
                  {isLocked && (
                    <div className="h-5 w-5 rounded-full bg-accent/90 flex items-center justify-center shadow-sm">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              )}

              {/* Swap trigger */}
              <Popover open={swapOpen === i} onOpenChange={(open) => {
                if (open) fetchAlternatives(i);
                else setSwapOpen(null);
              }}>
                <PopoverTrigger asChild>
                  <button className="absolute -top-1.5 -right-1.5 h-7 w-7 rounded-full bg-background border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted active:scale-95 transition-transform">
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
              </Popover>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      <div className="px-3 pb-2">
        <p className="text-[13px] text-muted-foreground leading-relaxed">{renderBoldMarkdown(explanation)}</p>
      </div>

      {/* Missing shoes notice */}
      {missingShoes && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-[1.25rem] bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <Shirt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
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

      {/* Action */}
      {!isRefining && (
        <div className="px-3 pb-3">
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
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    {t('outfit.save_without_shoes')}
                  </>
                )}
              </Button>
            </div>
          ) : onRefine && onSave ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-full text-[13px] h-11 gap-1.5 border-accent/60 text-accent hover:bg-accent/10 hover:text-accent"
                onClick={() => {
                  hapticLight();
                  onRefine(garments.map(g => g.id), explanation);
                }}
              >
                {t('chat.refine')}
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-full text-[13px] h-11 gap-1.5"
                onClick={() => {
                  hapticLight();
                  onSave(garments.map(g => g.id));
                }}
                disabled={isSaving || isSaved}
              >
                {isSaving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : isSaved ? (
                  t('chat.saved')
                ) : (
                  t('chat.save')
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full rounded-full text-[13px] h-11 gap-1.5"
              onClick={() => onTryOutfit(garments.map(g => g.id))}
              disabled={isCreating}
            >
              {isCreating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  {t('outfit.try_this')}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
