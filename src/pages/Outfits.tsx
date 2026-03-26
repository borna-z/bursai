import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { BursLoadingScreen } from '@/components/layout/BursLoadingScreen';
import { OutfitsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { useLanguage } from '@/contexts/LanguageContext';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { BursMonogram } from '@/components/ui/BursMonogram';
import { TAP_TRANSITION } from '@/lib/motion';

/* ── 2×2 outfit composition grid ── */
function OutfitGrid({ items, compact = false }: { items: OutfitWithItems['outfit_items']; compact?: boolean }) {
  const slots = items.slice(0, 4);

  const cells = Array.from({ length: 4 }, (_, i) => {
    const item = slots[i];
    if (item?.garment) {
      return (
        <div key={item.id} className="aspect-square overflow-hidden bg-[#F5F0E8]">
          <LazyImageSimple
            imagePath={getPreferredGarmentImagePath(item.garment)}
            alt={item.garment.title || item.slot}
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    return (
      <div key={`empty-${i}`} className="aspect-square bg-[#F5F0E8] flex items-center justify-center">
        <BursMonogram size={compact ? 12 : 18} className="opacity-10" />
      </div>
    );
  });

  return (
    <div
      className="aspect-square grid grid-cols-2 grid-rows-2 bg-[#F5F0E8]"
      style={{ gap: '0.5px' }}
    >
      {cells}
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
      <div className="bg-[hsl(var(--card))] overflow-hidden">
        <OutfitGrid items={outfit.outfit_items} />
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
          <OutfitsOnboardingEmpty />
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
