import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useFlatGarments } from '@/hooks/useGarments';
import { LazyImage } from '@/components/ui/lazy-image';
import { SectionHeader } from '@/components/ui/section-header';
import { useLanguage } from '@/contexts/LanguageContext';

export function RecentGarments() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: garments } = useFlatGarments({ sortBy: 'created_at' });

  const recent = (garments || []).slice(0, 6);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title={t('home.recent')} />
        <button
          onClick={() => navigate('/wardrobe')}
          className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {t('home.see_all')}
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {recent.map((garment) => (
          <button
            key={garment.id}
            onClick={() => navigate(`/wardrobe/${garment.id}`)}
            className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden active:scale-95 transition-transform"
          >
            <LazyImage
              imagePath={garment.image_path}
              alt={garment.title}
              aspectRatio="1/1"
              className="rounded-xl"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
