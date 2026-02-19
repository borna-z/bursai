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
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/80 px-2 py-1.5 my-1 mr-1 hover:bg-accent/40 transition-colors max-w-[200px]"
    >
      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-muted">
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-10 h-10 object-cover"
          fallbackIcon={<Shirt className="w-5 h-5" />}
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate text-foreground">{garment.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">{garment.category}</p>
      </div>
    </Link>
  );
}
