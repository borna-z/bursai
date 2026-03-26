import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { occasionLabel } from '@/lib/humanize';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface UsageInsights {
  wearCount: number;
  daysSinceLastWorn: number | null;
  wearFrequency: string;
  daysOwned: number;
  status: 'active' | 'neglected' | 'new';
}

interface OutfitItem {
  id: string;
  slot: string;
  garment?: {
    title: string;
    image_path?: string | null;
    render_image_path?: string | null;
    nobg_image_path?: string | null;
    image_processing_status?: string | null;
    render_status?: string | null;
  } | null;
}

interface OutfitEntry {
  id: string;
  occasion: string;
  outfit_items: OutfitItem[];
}

interface GarmentOutfitHistoryProps {
  outfitHistory: OutfitEntry[] | undefined;
  usageInsights: UsageInsights | null;
}

export function GarmentOutfitHistory({ outfitHistory, usageInsights }: GarmentOutfitHistoryProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {outfitHistory && outfitHistory.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)' }}>
            Worn in {outfitHistory.length} outfit{outfitHistory.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
            {outfitHistory.slice(0, 8).map((outfit) => (
              <button
                key={outfit.id}
                onClick={() => { hapticLight(); navigate(`/outfits/${outfit.id}`); }}
                style={{
                  flexShrink: 0, width: 88, display: 'flex', flexDirection: 'column', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ aspectRatio: '1/1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, overflow: 'hidden', background: '#EDE8DF' }}>
                  {outfit.outfit_items.slice(0, 4).map((item) => (
                    <div key={item.id} style={{ overflow: 'hidden' }}>
                      <LazyImageSimple
                        imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                        alt={item.garment?.title || item.slot}
                        className="w-full h-full"
                      />
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.5)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {occasionLabel(t, outfit.occasion)}
                </p>
              </button>
            ))}
          </div>

          {/* Usage stats */}
          {usageInsights && (
            <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>{usageInsights.wearCount}</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Total wears</p>
                </div>
                <div>
                  <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>{usageInsights.wearFrequency}×</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Per month</p>
                </div>
                {usageInsights.daysSinceLastWorn != null && (
                  <div>
                    <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>
                      {usageInsights.daysSinceLastWorn === 0 ? 'Today' : `${usageInsights.daysSinceLastWorn}d`}
                    </p>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Last worn</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 14, color: 'rgba(28,25,23,0.5)', margin: 0 }}>
            No outfits yet
          </p>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.35)', marginTop: 4 }}>
            Style this piece to create your first look.
          </p>
        </div>
      )}
    </motion.div>
  );
}
