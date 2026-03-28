import { WashingMachine } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const colorFilters = ['black', 'white', 'grey', 'navy', 'blue', 'red', 'green', 'beige', 'brown'];
const seasonFilters = ['spring', 'summer', 'autumn', 'winter'];

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  onCategoryChange: (cat: string) => void;
  color: string | null;
  onColorChange: (color: string | null) => void;
  season: string | null;
  onSeasonChange: (season: string | null) => void;
  sortBy: 'created_at' | 'last_worn_at' | 'wear_count';
  onSortChange: (sort: 'created_at' | 'last_worn_at' | 'wear_count') => void;
  showLaundry: boolean;
  onLaundryChange: (show: boolean) => void;
  onClear: () => void;
  categories: { id: string; label: string }[];
}

export function FilterSheet({
  open, onOpenChange,
  category, onCategoryChange,
  color, onColorChange,
  season, onSeasonChange,
  sortBy, onSortChange,
  showLaundry, onLaundryChange,
  onClear,
  categories,
}: FilterSheetProps) {
  const { t } = useLanguage();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[1.5rem] max-h-[70vh] overflow-y-auto px-5 pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">{t('wardrobe.filter')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Category */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider">
              {t('wardrobe.category')}
            </span>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    'px-3.5 py-2 rounded-full text-xs font-medium transition-colors border',
                    category === cat.id
                      ? 'bg-accent text-accent-foreground border-accent/30'
                      : 'surface-inset text-muted-foreground'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider">
              {t('wardrobe.sort')}
            </span>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'created_at' as const, label: t('wardrobe.sort.latest') },
                { key: 'last_worn_at' as const, label: t('wardrobe.sort.last_worn') },
                { key: 'wear_count' as const, label: t('wardrobe.sort.most_used') },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => onSortChange(s.key)}
                  className={cn(
                    'px-3.5 py-2 rounded-full text-xs font-medium transition-colors border',
                    sortBy === s.key
                      ? 'bg-accent/10 text-accent border-accent/20'
                      : 'surface-inset text-muted-foreground'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider">
              {t('wardrobe.color')}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {colorFilters.map((c) => (
                <button
                  key={c}
                  onClick={() => onColorChange(color === c ? null : c)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-full text-xs transition-colors border',
                    color === c
                      ? 'bg-accent/10 text-accent font-medium border-accent/20'
                      : 'surface-inset text-muted-foreground'
                  )}
                >
                  {t(`color.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Season */}
          <div className="space-y-2">
            <span className="text-[11px] text-muted-foreground/70 font-medium uppercase tracking-wider">
              {t('wardrobe.season')}
            </span>
            <div className="flex gap-2">
              {seasonFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => onSeasonChange(season === s ? null : s)}
                  className={cn(
                    'flex-1 py-2 rounded-full text-xs transition-colors capitalize border',
                    season === s
                      ? 'bg-accent/10 text-accent font-medium border-accent/20'
                      : 'surface-inset text-muted-foreground'
                  )}
                >
                  {t(`garment.season.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Laundry toggle */}
          <button
            onClick={() => onLaundryChange(!showLaundry)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-[1.25rem] text-sm font-medium transition-colors w-full border',
              showLaundry
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'surface-inset text-muted-foreground'
            )}
          >
            <WashingMachine className="w-4 h-4" />
            {t('wardrobe.in_laundry')}
          </button>

          {/* Clear */}
          <Button
            variant="ghost"
            onClick={() => { onClear(); onOpenChange(false); }}
            className="w-full text-sm text-muted-foreground"
          >
            {t('wardrobe.clear')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
