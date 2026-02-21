import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Film, Star, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { EmptyState } from '@/components/layout/EmptyState';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { OutfitReel } from './OutfitReel';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/dateLocale';

function OutfitMiniCard({ outfit }: { outfit: OutfitWithItems }) {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();

  return (
    <button
      onClick={() => navigate(`/outfits/${outfit.id}`)}
      className="w-full glass-card rounded-xl overflow-hidden transition-all active:scale-[0.98] text-left"
    >
      <div className="flex h-20 bg-muted/30">
        {outfit.outfit_items.slice(0, 4).map((item, index) => (
          <div
            key={item.id}
            className={cn(
              'flex-1 overflow-hidden',
              index < outfit.outfit_items.slice(0, 4).length - 1 && 'border-r border-background'
            )}
          >
            <LazyImageSimple
              imagePath={item.garment?.image_path}
              alt={item.garment?.title || item.slot}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
      <div className="p-2.5 flex items-center gap-2">
        <Badge variant="secondary" className="capitalize text-xs">{t(`occasion.${outfit.occasion}`)}</Badge>
        {outfit.rating && (
          <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="w-3 h-3 fill-primary text-primary" />{outfit.rating}
          </div>
        )}
        {outfit.generated_at && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {format(new Date(outfit.generated_at), 'd MMM', { locale: getDateFnsLocale(locale) })}
          </span>
        )}
      </div>
    </button>
  );
}

export function WardrobeOutfitsTab() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits(false);
  const [showReel, setShowReel] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!outfits || outfits.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title={t('wardrobe.no_outfits')}
        description={t('wardrobe.no_outfits_desc')}
        action={{ label: t('outfits.create'), onClick: () => navigate('/'), icon: Sparkles }}
      />
    );
  }

  return (
    <>
      {/* Create reel button */}
      <Button
        variant="outline"
        className="w-full glass-card rounded-xl mb-4"
        onClick={() => setShowReel(true)}
      >
        <Film className="w-4 h-4 mr-2" />
        {t('wardrobe.create_reel')}
      </Button>

      {/* Outfit grid */}
      <div className="grid grid-cols-2 gap-3 stagger-burs">
        {outfits.map((outfit, index) => (
          <div
            key={outfit.id}
            className="animate-drape-in"
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, animationFillMode: 'both' }}
          >
            <OutfitMiniCard outfit={outfit} />
          </div>
        ))}
      </div>

      {/* Reel overlay */}
      {showReel && (
        <OutfitReel outfits={outfits} onClose={() => setShowReel(false)} />
      )}
    </>
  );
}
