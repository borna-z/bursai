import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface SimilarGarment {
  id: string;
  title: string;
  image_path?: string | null;
  render_image_path?: string | null;
  nobg_image_path?: string | null;
  render_status?: string | null;
}

interface GarmentSimilarItemsProps {
  similarGarments: SimilarGarment[] | undefined;
}

export function GarmentSimilarItems({ similarGarments }: GarmentSimilarItemsProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {similarGarments && similarGarments.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {similarGarments.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/wardrobe/${g.id}`)}
              className="flex min-w-0 flex-col gap-1.5 border-none bg-transparent text-left"
            >
              <div className="aspect-[3/4] overflow-hidden bg-secondary/45">
                <LazyImageSimple
                  imagePath={getPreferredGarmentImagePath(g)}
                  alt={g.title}
                  className="w-full h-full"
                />
              </div>
              <p className="m-0 line-clamp-2 font-body text-[11px] text-foreground/60">
                {g.title}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="font-display italic text-sm text-foreground/50 m-0">
            {t('garment.similar.no_items')}
          </p>
          <p className="font-body text-[11px] text-foreground/[0.35] mt-1">
            {t('garment.similar.no_items_hint')}
          </p>
        </div>
      )}
    </motion.div>
  );
}
