import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';

interface UnusedGemCardProps {
  garment: {
    id: string;
    title: string;
    image_path: string | null;
    original_image_path?: string | null;
    rendered_image_path?: string | null;
    render_status?: string | null;
    category: string;
    color_primary: string;
  };
  daysUnused: number;
  onCreateOutfit: () => void;
}

export function UnusedGemCard({ garment, daysUnused, onCreateOutfit }: UnusedGemCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-3 py-3 group hover:opacity-70 transition-opacity">
      <div 
        className="cursor-pointer"
        onClick={() => navigate(`/wardrobe/${garment.id}`)}
      >
        <LazyImageSimple
          imagePath={getPreferredGarmentImagePath(garment)}
          alt={garment.title}
          className="w-14 h-14 rounded-lg flex-shrink-0 shadow-sm"
        />
      </div>
      
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/wardrobe/${garment.id}`)}
      >
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {garment.category} • {t('gem.days_ago').replace('{count}', String(daysUnused))}
        </p>
      </div>
      
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "flex-shrink-0 h-8 px-2 text-xs",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-primary hover:text-primary-foreground"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onCreateOutfit();
        }}
      >
        <Sparkles className="w-3 h-3 mr-1" />
        {t('gem.outfit')}
      </Button>
    </div>
  );
}