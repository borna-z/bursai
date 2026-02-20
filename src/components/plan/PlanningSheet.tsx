import { useState } from 'react';
import { format } from 'date-fns';
import { List, Sparkles, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useOutfits, type OutfitWithItems } from '@/hooks/useOutfits';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanningSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onSelectOutfit: (outfitId: string) => void;
  onCreateNew: () => void;
}

export function PlanningSheet({ open, onOpenChange, date, onSelectOutfit, onCreateNew }: PlanningSheetProps) {
  const [mode, setMode] = useState<'choose' | 'select'>('choose');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: outfits, isLoading } = useOutfits(true);
  const { t } = useLanguage();

  const filteredOutfits = outfits?.filter(outfit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return outfit.occasion?.toLowerCase().includes(query) || outfit.style_vibe?.toLowerCase().includes(query) || outfit.explanation?.toLowerCase().includes(query);
  }) || [];

  const handleClose = () => { setMode('choose'); setSearchQuery(''); onOpenChange(false); };
  const handleSelectOutfit = (outfit: OutfitWithItems) => { onSelectOutfit(outfit.id); handleClose(); };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle>{t('plan.plan')} {date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</SheetTitle>
          <SheetDescription>
            {mode === 'choose' ? t('planning.choose_how') : t('planning.choose_saved')}
          </SheetDescription>
        </SheetHeader>

        {mode === 'choose' ? (
          <div className="space-y-3 pt-2">
            <Button variant="outline" size="lg" className="w-full justify-start h-auto py-4 px-4" onClick={() => setMode('select')}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><List className="w-5 h-5 text-primary" /></div>
                <div className="text-left">
                  <p className="font-medium">{t('planning.from_saved')}</p>
                  <p className="text-sm text-muted-foreground">{t('planning.use_existing')}</p>
                </div>
              </div>
            </Button>
            <Button variant="outline" size="lg" className="w-full justify-start h-auto py-4 px-4" onClick={() => { onCreateNew(); handleClose(); }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Sparkles className="w-5 h-5 text-primary" /></div>
                <div className="text-left">
                  <p className="font-medium">{t('planning.create_new')}</p>
                  <p className="text-sm text-muted-foreground">{t('planning.generate_for_day')}</p>
                </div>
              </div>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100%-80px)]">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('planning.search_outfit')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex-1 space-y-2 -mx-6 px-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : filteredOutfits.length > 0 ? (
                filteredOutfits.map((outfit) => (
                  <button key={outfit.id} onClick={() => handleSelectOutfit(outfit)} className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors active:scale-[0.99] text-left">
                    <div className="flex h-12 w-20 rounded overflow-hidden bg-muted/30 flex-shrink-0">
                      {outfit.outfit_items.slice(0, 3).map((item, index) => (
                        <div key={item.id} className={cn("flex-1 overflow-hidden", index < 2 && "border-r border-background")}>
                          <LazyImageSimple imagePath={item.garment?.image_path} alt={item.garment?.title || ''} className="w-full h-full" />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize text-xs">{outfit.occasion}</Badge>
                        {outfit.style_vibe && (<Badge variant="outline" className="text-xs">{outfit.style_vibe}</Badge>)}
                      </div>
                      {outfit.explanation && (<p className="text-xs text-muted-foreground line-clamp-1">{outfit.explanation}</p>)}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground"><p>{t('planning.no_outfits')}</p></div>
              )}
            </div>
            <div className="pt-4 border-t mt-4">
              <Button variant="ghost" className="w-full" onClick={() => setMode('choose')}>{t('common.back')}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
