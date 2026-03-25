import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { Shirt } from 'lucide-react';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { SectionHeader } from '@/components/ui/section-header';
import type { Garment } from '@/hooks/useGarments';
import { cn } from '@/lib/utils';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface SmartGroupingsProps {
  garments: Garment[];
}

export function SmartGroupings({ garments }: SmartGroupingsProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const { rarelyWorn, mostWorn, recentlyAdded } = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString();

    const rarely = garments
      .filter((g) => !g.last_worn_at || g.last_worn_at < thirtyDaysStr)
      .sort((a, b) => (a.wear_count || 0) - (b.wear_count || 0))
      .slice(0, 10);

    const most = [...garments]
      .sort((a, b) => (b.wear_count || 0) - (a.wear_count || 0))
      .filter((g) => (g.wear_count || 0) > 0)
      .slice(0, 10);

    const recent = [...garments]
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 10);

    return { rarelyWorn: rarely, mostWorn: most, recentlyAdded: recent };
  }, [garments]);

  return (
    <div className="space-y-6">
      {rarelyWorn.length > 0 && (
        <GroupRow
          title={t('wardrobe.rarely_worn')}
          garments={rarelyWorn}
          onTap={(id) => navigate(`/wardrobe/${id}`)}
        />
      )}
      {mostWorn.length > 0 && (
        <GroupRow
          title={t('wardrobe.most_worn')}
          garments={mostWorn}
          onTap={(id) => navigate(`/wardrobe/${id}`)}
        />
      )}
      {recentlyAdded.length > 0 && (
        <GroupRow
          title={t('wardrobe.recently_added')}
          garments={recentlyAdded}
          onTap={(id) => navigate(`/wardrobe/${id}`)}
        />
      )}
    </div>
  );
}

function GroupRow({
  title,
  garments,
  onTap,
}: {
  title: string;
  garments: Garment[];
  onTap: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <SectionHeader title={title} />
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {garments.map((g) => (
          <motion.button
            key={g.id}
            whileTap={{ scale: 0.96 }}
            transition={TAP_TRANSITION}
            onClick={() => onTap(g.id)}
            className={cn(
              'flex-shrink-0 w-[120px] rounded-xl overflow-hidden will-change-transform',
              g.in_laundry && 'opacity-50'
            )}
          >
            <div className="aspect-[3/4] bg-muted relative overflow-hidden rounded-xl">
              <LazyImageSimple
                imagePath={getPreferredGarmentImagePath(g)}
                alt={g.title}
                className="w-full h-full"
                fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/30" />}
              />
              {(g.wear_count || 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[10px] font-medium bg-background/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-foreground/80">
                  {g.wear_count}×
                </span>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
