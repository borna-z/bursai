import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface SimilarGarment {
  id: string;
  title: string;
  image_path?: string | null;
  render_image_path?: string | null;
  nobg_image_path?: string | null;
  image_processing_status?: string | null;
  render_status?: string | null;
}

interface GarmentSimilarItemsProps {
  similarGarments: SimilarGarment[] | undefined;
}

export function GarmentSimilarItems({ similarGarments }: GarmentSimilarItemsProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {similarGarments && similarGarments.length > 0 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          {similarGarments.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/wardrobe/${g.id}`)}
              className="shrink-0 w-[100px] flex flex-col gap-1.5 bg-transparent border-none cursor-pointer text-left"
            >
              <div className="aspect-[3/4] overflow-hidden bg-card">
                <LazyImageSimple
                  imagePath={getPreferredGarmentImagePath(g)}
                  alt={g.title}
                  className="w-full h-full"
                />
              </div>
              <p className="font-['DM_Sans'] text-[10px] text-foreground/60 overflow-hidden text-ellipsis whitespace-nowrap m-0">
                {g.title}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="font-['Playfair_Display'] italic text-sm text-foreground/50 m-0">
            No similar items found
          </p>
          <p className="font-['DM_Sans'] text-[11px] text-foreground/[0.35] mt-1">
            Add more garments to find stronger matches.
          </p>
        </div>
      )}
    </motion.div>
  );
}
