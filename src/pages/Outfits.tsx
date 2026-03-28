import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { BursLoadingScreen } from '@/components/layout/BursLoadingScreen';
import { OutfitsOnboardingEmpty } from '@/components/onboarding/OnboardingEmptyState';
import { OutfitPreviewCard } from '@/components/ui/OutfitPreviewCard';
import { PageIntro } from '@/components/ui/page-intro';
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
        surface="editorial"
        density="comfortable"
        mediaLayout="stacked"
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
      <div className="page-shell animate-fade-in">
        <PageIntro
          eyebrow="Archive"
          meta={
            outfits && outfits.length > 0 ? (
              <span className="eyebrow-chip border-transparent bg-secondary/85 text-foreground/62">
                {outfits.length} looks
              </span>
            ) : undefined
          }
          title="Your Looks"
          description="Saved outfits, editorial combinations, and the formulas worth repeating."
        />

        {!outfits || outfits.length === 0 ? (
          <OutfitsOnboardingEmpty />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
