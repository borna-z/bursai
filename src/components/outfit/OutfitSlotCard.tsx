import { RefreshCw, Shirt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { cn } from '@/lib/utils';

const slotLabels: Record<string, string> = {
  top: 'Överdel',
  bottom: 'Underdel',
  shoes: 'Skor',
  outerwear: 'Ytterkläder',
  accessory: 'Accessoar',
  dress: 'Klänning',
  fullbody: 'Helkropp',
};

interface OutfitSlotCardProps {
  slot: string;
  garmentId: string;
  garmentTitle?: string;
  garmentColor?: string;
  garmentCategory?: string;
  imagePath?: string;
  onSwap: () => void;
  isLoading?: boolean;
}

export function OutfitSlotCard({
  slot,
  garmentId,
  garmentTitle,
  garmentColor,
  garmentCategory,
  imagePath,
  onSwap,
  isLoading,
}: OutfitSlotCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0 flex">
          <Skeleton className="w-24 h-[120px] flex-shrink-0" />
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-16 self-end" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden group transition-all hover:shadow-md active:scale-[0.99]">
      <CardContent className="p-0 flex">
        {/* Image with 4:5 ratio */}
        <div 
          className="w-24 flex-shrink-0 cursor-pointer"
          onClick={() => navigate(`/wardrobe/${garmentId}`)}
        >
          <LazyImageSimple
            imagePath={imagePath}
            alt={garmentTitle || slot}
            className="w-24 h-[120px]"
            fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/30" />}
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div 
            className="cursor-pointer"
            onClick={() => navigate(`/wardrobe/${garmentId}`)}
          >
            {/* Slot name */}
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {slotLabels[slot] || slot}
            </p>
            {/* Item title */}
            <p className="font-semibold text-sm truncate mt-0.5">
              {garmentTitle || 'Okänt plagg'}
            </p>
            {/* Meta: color + category */}
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {[garmentColor, garmentCategory].filter(Boolean).join(' • ')}
            </p>
          </div>
          
          {/* Swap button - primary action */}
          <Button 
            variant="outline"
            size="sm"
            className={cn(
              "self-end mt-2 h-7 px-3 text-xs font-medium",
              "transition-all hover:bg-primary hover:text-primary-foreground",
              "active:scale-95"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSwap();
            }}
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Byt ut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OutfitSlotCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0 flex">
        <Skeleton className="w-24 h-[120px] flex-shrink-0" />
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-16 self-end" />
        </div>
      </CardContent>
    </Card>
  );
}
