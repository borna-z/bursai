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
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
          {similarGarments.map((g) => (
            <button
              key={g.id}
              onClick={() => navigate(`/wardrobe/${g.id}`)}
              style={{
                flexShrink: 0, width: 100, display: 'flex', flexDirection: 'column', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: '#EDE8DF' }}>
                <LazyImageSimple
                  imagePath={getPreferredGarmentImagePath(g)}
                  alt={g.title}
                  className="w-full h-full"
                />
              </div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                {g.title}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 14, color: 'rgba(28,25,23,0.5)', margin: 0 }}>
            No similar items found
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.35)', marginTop: 4 }}>
            Add more garments to discover matches.
          </p>
        </div>
      )}
    </motion.div>
  );
}
