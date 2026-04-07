import type { ElementType } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WardrobeCollectionTileModel } from '@/components/wardrobe/wardrobeTypes';
import type { WardrobeSmartFilter } from '@/hooks/useWardrobeView';
import { useLanguage } from '@/contexts/LanguageContext';

const TILE_ICONS = {
  rarely_worn: Clock3,
  most_worn: TrendingUp,
  new: Sparkles,
} satisfies Record<Exclude<WardrobeSmartFilter, null>, ElementType>;

interface WardrobeSmartAccessProps {
  tiles: WardrobeCollectionTileModel[];
  onSelect: (filter: WardrobeSmartFilter) => void;
}

export function WardrobeSmartAccess({ tiles, onSelect }: WardrobeSmartAccessProps) {
  const { t } = useLanguage();
  if (tiles.length === 0) return null;

  return (
    <section aria-label={t('wardrobe.smart_access')}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tiles.map((tile, index) => {
          const Icon = TILE_ICONS[tile.key];

          return (
            <motion.button
              key={tile.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.24 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(tile.active ? null : tile.key)}
              className={cn(
                'min-h-[40px] rounded-[1.35rem] border px-4 py-4 text-left transition-colors',
                tile.active
                  ? 'border-accent bg-accent text-accent-foreground shadow-[0_18px_34px_rgba(0,0,0,0.24)]'
                  : 'border border-border/40 text-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-[1.1rem]',
                      tile.active ? 'bg-background/12 text-background' : 'bg-foreground/[0.04] text-foreground/70',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('truncate text-[13px] font-medium', tile.active && 'text-background')}>{tile.label}</p>
                    <p className={cn('text-xs', tile.active ? 'text-background/70' : 'text-muted-foreground')}>
                      {t('wardrobe.pieces_count').replace('{count}', String(tile.count))}
                    </p>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
