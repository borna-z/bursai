import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

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
}

export function OutfitSuggestionCard({ garments: initialGarments, explanation, onTryOutfit, isCreating }: OutfitSuggestionCardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [garments, setGarments] = useState(initialGarments);
  const [swapOpen, setSwapOpen] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<GarmentBasic[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  const fetchAlternatives = useCallback(async (index: number) => {
    if (!user) return;
    const current = garments[index];
    setSwapOpen(index);
    setLoadingAlts(true);
    setAlternatives([]);

    try {
      const { data } = await supabase
        .from('garments')
        .select('id, title, category, color_primary, image_path')
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

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden animate-scale-in shadow-sm">
      {/* Garment row */}
      <div className="flex gap-1 p-3 overflow-x-auto scrollbar-hide">
        {garments.map((g, i) => (
          <div key={g.id} className="relative shrink-0 group">
            <Link to={`/wardrobe/${g.id}`} className="block">
              <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-muted border border-border/40">
                <LazyImageSimple
                  imagePath={g.image_path}
                  alt={g.title}
                  className="w-full h-full object-cover"
                  fallbackIcon={<Shirt className="w-5 h-5" />}
                />
              </div>
            </Link>
            <p className="text-[10px] text-muted-foreground truncate w-[72px] mt-1 text-center">{g.title}</p>
            {/* Swap trigger */}
            <Popover open={swapOpen === i} onOpenChange={(open) => {
              if (open) fetchAlternatives(i);
              else setSwapOpen(null);
            }}>
              <PopoverTrigger asChild>
                <button className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted">
                  <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 space-y-1.5" side="bottom" align="center">
                <p className="text-[10px] font-medium text-muted-foreground px-1">{t('outfit.swap_title') || 'Byt ut'}</p>
                {loadingAlts ? (
                  <div className="flex items-center justify-center py-3 px-4">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  </div>
                ) : alternatives.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1 py-2">{t('outfit.no_alternatives') || 'No alternatives'}</p>
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
                            imagePath={alt.image_path}
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
        ))}
      </div>

      {/* Explanation */}
      <div className="px-3 pb-2">
        <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
      </div>

      {/* Action */}
      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full rounded-xl text-xs h-9 gap-1.5"
          onClick={() => onTryOutfit(garments.map(g => g.id))}
          disabled={isCreating}
        >
          {isCreating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <ArrowRight className="w-3.5 h-3.5" />
              {t('outfit.try_this') || 'Testa denna outfit'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
