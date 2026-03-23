import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { BursLoadingScreen } from '@/components/layout/BursLoadingScreen';
import { EmptyState } from '@/components/layout/EmptyState';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { BursMonogram } from '@/components/ui/BursMonogram';
import { TAP_TRANSITION } from '@/lib/motion';

/* ── Staggered image stack (up to 3 garment thumbnails) ── */
function ImageStack({ items }: { items: OutfitWithItems['outfit_items'] }) {
  const images = items.slice(0, 3);

  if (images.length === 0) {
    return (
      <div className="relative w-full aspect-square bg-[#F5F0E8] flex items-center justify-center">
        <BursMonogram size={32} className="opacity-15" />
      </div>
    );
  }

  const positions = [
    'top-2 left-2',
    'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'bottom-2 right-2',
  ];

  return (
    <div className="relative w-full aspect-square bg-[#F5F0E8] overflow-hidden">
      {images.map((item, i) => (
        <div
          key={item.id}
          className={`absolute ${positions[i]} w-14 h-14 overflow-hidden bg-[#F5F0E8]`}
          style={{ zIndex: i }}
        >
          <LazyImageSimple
            imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
            alt={item.garment?.title || item.slot}
            className="w-14 h-14 object-cover"
          />
        </div>
      ))}
    </div>
  );
}

/* ── Outfit Card ── */
function OutfitCard({ outfit }: { outfit: OutfitWithItems }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const occasionLabel = t(`occasion.${outfit.occasion}`) || outfit.occasion || '';
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 60
      ? `${outfit.explanation.slice(0, 60)}…`
      : outfit.explanation
    : '';

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onClick={() => navigate(`/outfits/${outfit.id}`)}
      className="cursor-pointer select-none will-change-transform"
    >
      <div className="bg-[#EDE8DF] overflow-hidden">
        <ImageStack items={outfit.outfit_items} />
        <div className="px-3 pt-2.5 pb-3 space-y-1">
          {occasionLabel && (
            <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-[#1C1917]/50">
              {occasionLabel}
            </p>
          )}
          {excerpt && (
            <p className="font-['Playfair_Display'] italic text-[13px] text-[#1C1917]/70 leading-snug line-clamp-1">
              {excerpt}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Page ── */
export default function OutfitsPage() {
  const navigate = useNavigate();
  const { data: outfits, isLoading } = useOutfits(true);

  if (isLoading) {
    return <BursLoadingScreen />;
  }

  return (
    <AppLayout>
      <div className="page-container pb-28 animate-fade-in">
        {/* Header */}
        <header className="pt-8 pb-6">
          <h1 className="font-['Playfair_Display'] text-[24px] text-[#1C1917]">
            Your Looks
          </h1>
        </header>

        {!outfits || outfits.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No looks yet"
            description="Generate your first outfit to get started"
            action={{
              label: 'Create a look',
              onClick: () => navigate('/outfits/generate'),
              icon: Sparkles,
            }}
            variant="editorial"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((outfit, index) => (
              <div
                key={outfit.id}
                className="animate-drape-in"
                style={{
                  animationDelay: `${Math.min(index, 12) * 40}ms`,
                  animationFillMode: 'both',
                }}
              >
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
