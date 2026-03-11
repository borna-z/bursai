import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { TAP_TRANSITION } from '@/lib/motion';
import { LazyImage } from '@/components/ui/lazy-image';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionHeader } from '@/components/ui/section-header';

export function OutfitsPreview() {
  const { t } = useLanguage();
  const { data: outfits } = useOutfits(true);
  const navigate = useNavigate();

  const preview = (outfits || []).slice(0, 4);
  if (preview.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <SectionHeader title={t('home.suggestions')} />
        <button
          onClick={() => navigate('/outfits')}
          className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('common.see_all')}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {preview.map((outfit) => (
          <OutfitMiniCard key={outfit.id} outfit={outfit} onTap={() => navigate(`/outfits/${outfit.id}`)} />
        ))}
      </div>
    </div>
  );
}

function OutfitMiniCard({ outfit, onTap }: { outfit: OutfitWithItems; onTap: () => void }) {
  const { t } = useLanguage();
  const items = outfit.outfit_items?.slice(0, 4) || [];

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onClick={onTap}
      className="rounded-2xl bg-foreground/[0.02] border border-border/30 overflow-hidden will-change-transform"
    >
      <div className="grid grid-cols-2 gap-0.5 p-1">
        {items.map((item) => (
          <LazyImage
            key={item.id}
            imagePath={item.garment?.image_path}
            alt={item.garment?.title || ''}
            aspectRatio="square"
            className="rounded-lg"
          />
        ))}
      </div>
      <div className="px-2.5 pb-2 pt-0.5">
        <span className="inline-block px-2 py-0.5 rounded-full bg-foreground/[0.05] text-[10px] font-medium text-muted-foreground">
          {t(`occasion.${outfit.occasion}`) || outfit.occasion}
        </span>
      </div>
    </motion.button>
  );
}
