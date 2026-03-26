import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { BursLoadingScreen } from '@/components/layout/BursLoadingScreen';
import { OutfitsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { OutfitPreviewCard } from '@/components/ui/OutfitPreviewCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { TAP_TRANSITION } from '@/lib/motion';

function OutfitCard({ outfit }: { outfit: OutfitWithItems }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const occasionLabel = t(`occasion.${outfit.occasion}`) || outfit.occasion || '';
  const excerpt = outfit.explanation
    ? outfit.explanation.length > 60
      ? `${outfit.explanation.slice(0, 60)}...`
      : outfit.explanation
    : '';

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onClick={() => navigate(`/outfits/${outfit.id}`)}
      className="cursor-pointer select-none will-change-transform"
    >
      <OutfitPreviewCard
        items={outfit.outfit_items}
        meta={occasionLabel ? (
          <p className="font-['DM_Sans'] text-[10px] uppercase tracking-[0.1em] text-foreground/50">
            {occasionLabel}
          </p>
        ) : undefined}
        excerpt={excerpt}
      />
    </motion.div>
  );
}

export default function OutfitsPage() {
  const { data: outfits, isLoading } = useOutfits(true);

  if (isLoading) {
    return <BursLoadingScreen />;
  }

  return (
    <AppLayout>
      <div className="page-container animate-fade-in pb-28">
        <header className="pb-6 pt-8">
          <h1 className="font-['Playfair_Display'] text-[24px] text-foreground">
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
