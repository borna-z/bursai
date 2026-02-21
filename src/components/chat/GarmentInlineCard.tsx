import { Link } from 'react-router-dom';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Shirt } from 'lucide-react';
import type { GarmentBasic } from '@/hooks/useGarmentsByIds';

interface Props {
  garment: GarmentBasic;
}

export function GarmentInlineCard({ garment }: Props) {
  return (
    <Link
      to={`/wardrobe/${garment.id}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 pl-1 pr-2.5 py-1 hover:bg-muted/70 transition-colors"
    >
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-muted">
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-7 h-7 object-cover"
          fallbackIcon={<Shirt className="w-3.5 h-3.5" />}
        />
      </div>
      <span className="text-xs font-medium truncate text-foreground max-w-[120px]">{garment.title}</span>
    </Link>
  );
}
