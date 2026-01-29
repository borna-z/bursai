import { useNavigate } from 'react-router-dom';
import { Sparkles, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

interface UnusedGemCardProps {
  garment: {
    id: string;
    title: string;
    image_path: string;
    category: string;
    color_primary: string;
  };
  daysUnused: number;
  onCreateOutfit: () => void;
}

export function UnusedGemCard({ garment, daysUnused, onCreateOutfit }: UnusedGemCardProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl group hover:bg-muted transition-colors">
      {/* Thumbnail */}
      <div 
        className="cursor-pointer"
        onClick={() => navigate(`/wardrobe/${garment.id}`)}
      >
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-14 h-14 rounded-lg flex-shrink-0 shadow-sm"
        />
      </div>
      
      {/* Info */}
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/wardrobe/${garment.id}`)}
      >
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {garment.category} • {daysUnused} dagar sedan
        </p>
      </div>
      
      {/* CTA */}
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
        Outfit
      </Button>
    </div>
  );
}
