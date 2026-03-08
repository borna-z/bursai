import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { LazyImage } from '@/components/ui/lazy-image';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionHeader } from '@/components/ui/section-header';

export function SwipeSuggestions() {
  const { t } = useLanguage();
  const { data: outfits } = useOutfits(true);
  const navigate = useNavigate();

  const recent = (outfits || []).slice(0, 10);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title={t('home.saved_outfits')} />
        <button
          onClick={() => navigate('/outfits')}
          className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {t('home.see_all')}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {recent.map((outfit) => (
          <SuggestionCard key={outfit.id} outfit={outfit} onTap={() => navigate(`/outfits/${outfit.id}`)} />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ outfit, onTap }: { outfit: OutfitWithItems; onTap: () => void }) {
  const { t } = useLanguage();
  const items = outfit.outfit_items?.slice(0, 4) || [];

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={TAP_TRANSITION}
      onClick={onTap}
      className="flex-shrink-0 w-[180px] rounded-2xl bg-card border border-border/20 overflow-hidden will-change-transform"
    >
      <div className="grid grid-cols-2 gap-0.5 p-1">
        {items.map((item) => (
          <LazyImage
            key={item.id}
            imagePath={item.garment?.image_path}
            alt={item.garment?.title || ''}
            aspectRatio="4/5"
            className="rounded-lg"
          />
        ))}
      </div>
      <div className="px-2.5 pb-2.5 pt-1">
        <span className="inline-block px-2 py-0.5 rounded-full bg-muted/30 text-[10px] font-medium text-muted-foreground">
          {t(`occasion.${outfit.occasion}`) || outfit.occasion}
        </span>
      </div>
    </motion.button>
  );
}
