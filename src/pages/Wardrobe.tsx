import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Loader2, WashingMachine, AlertTriangle, Crown,
  Grid3X3, List, SlidersHorizontal, X, Trash2, Shirt, Sparkles, ScanLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGarments, useUpdateGarment, useDeleteGarment, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Chip } from '@/components/ui/chip';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { QuickEditPanel } from '@/components/wardrobe/QuickEditPanel';
import { useLanguage } from '@/contexts/LanguageContext';

const colorFilters = ['svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'];
const seasonFilters = ['vår', 'sommar', 'höst', 'vinter'];

function isNewGarment(garment: Garment): boolean {
  if (!garment.created_at) return false;
  const createdAt = new Date(garment.created_at);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return createdAt > oneDayAgo;
}

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  isNew: boolean;
  onSelect: () => void;
  onLaundry: () => void;
  t: (key: string) => string;
}

function GarmentCard({ garment, isGridView, isSelecting, isSelected, isNew, onSelect, onLaundry, t }: GarmentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isSelecting) { onSelect(); } else { navigate(`/wardrobe/${garment.id}`); }
  };

  if (!isGridView) {
    return (
      <Card className={cn('cursor-pointer hover:shadow-md transition-all overflow-hidden active:scale-[0.99]', garment.in_laundry && 'opacity-60', isSelected && 'ring-2 ring-primary')} onClick={handleClick}>
        <div className="flex items-center gap-3 p-3">
          {isSelecting && <Checkbox checked={isSelected} className="shrink-0" />}
          <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-16 h-16 rounded-lg shrink-0" fallbackIcon={<Shirt className="w-6 h-6 text-muted-foreground/30" />} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm truncate">{garment.title}</p>
              {isNew && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />{t('wardrobe.new_badge')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
              {garment.category} • <span className="capitalize">{garment.color_primary}</span>
            </p>
          </div>
          {garment.in_laundry && <WashingMachine className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('cursor-pointer hover:shadow-md transition-all overflow-hidden group active:scale-[0.98]', garment.in_laundry && 'opacity-60', isSelected && 'ring-2 ring-primary')} onClick={handleClick}>
      <div className="aspect-square bg-muted relative">
        <LazyImageSimple imagePath={garment.image_path} alt={garment.title} className="w-full h-full" fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/50" />} />
        {isNew && !isSelecting && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-5 bg-primary text-primary-foreground">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />{t('wardrobe.new_badge')}
          </Badge>
        )}
        {isSelecting && <div className="absolute top-2 left-2"><Checkbox checked={isSelected} className="bg-background/80" /></div>}
        {!isSelecting && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="secondary" className="w-7 h-7 bg-background/80 hover:bg-background active:animate-press" onClick={(e) => { e.stopPropagation(); onLaundry(); }}>
              <WashingMachine className={cn('w-3.5 h-3.5', garment.in_laundry && 'text-primary')} />
            </Button>
          </div>
        )}
        {garment.in_laundry && !isSelecting && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] bg-background/90 px-1.5 py-0.5 rounded-full font-medium">{t('wardrobe.in_laundry')}</span>
          </div>
        )}
      </div>
      <CardContent className="p-2.5">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category} • {garment.color_primary}</p>
      </CardContent>
    </Card>
  );
}

export default function WardrobePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [filters, setFilters] = useState<GarmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  
  const { data: garments, isLoading } = useGarments({
    ...filters, search,
    category: selectedCategory === 'all' || selectedCategory === 'new' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
  });
  const { canAddGarment, isPremium, subscription } = useSubscription();

  const categories = [
    { id: 'all', label: t('wardrobe.all') },
    { id: 'new', label: t('wardrobe.new') },
    { id: 'top', label: t('wardrobe.top') },
    { id: 'bottom', label: t('wardrobe.bottom') },
    { id: 'shoes', label: t('wardrobe.shoes') },
    { id: 'outerwear', label: t('wardrobe.outerwear') },
    { id: 'accessory', label: t('wardrobe.accessory') },
    { id: 'dress', label: t('wardrobe.dress') },
  ];

  const sortOptions = [
    { id: 'created_at', label: t('wardrobe.sort.latest') },
    { id: 'wear_count', label: t('wardrobe.sort.most_used') },
    { id: 'last_worn_at', label: t('wardrobe.sort.least_used') },
  ];

  const { displayGarments, newGarments } = useMemo(() => {
    if (!garments) return { displayGarments: [], newGarments: [] };
    const newG = garments.filter(isNewGarment);
    if (selectedCategory === 'new') return { displayGarments: newG, newGarments: newG };
    return { displayGarments: garments, newGarments: newG };
  }, [garments, selectedCategory]);

  const handleFilterChange = (key: keyof GarmentFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value === 'all' ? undefined : value }));
  };

  const handleAddGarment = () => {
    if (canAddGarment()) { navigate('/wardrobe/add'); } else { setShowPaywall(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkLaundry = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => updateGarment.mutateAsync({ id, updates: { in_laundry: true } })));
      toast.success(`${selectedIds.size} ${t('wardrobe.in_laundry_toast')}`);
      setSelectedIds(new Set()); setIsSelecting(false);
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteGarment.mutateAsync(id)));
      toast.success(`${selectedIds.size} ${t('wardrobe.removed')}`);
      setSelectedIds(new Set()); setIsSelecting(false);
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleToggleLaundry = async (garment: Garment) => {
    try {
      await updateGarment.mutateAsync({ id: garment.id, updates: { in_laundry: !garment.in_laundry } });
      toast.success(garment.in_laundry ? t('wardrobe.available') : t('wardrobe.in_laundry_toast'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const currentCount = subscription?.garments_count || 0;
  const isOverLimit = !isPremium && currentCount >= PLAN_LIMITS.free.maxGarments;

  const clearFilters = () => { setSelectedCategory('all'); setSelectedColor(null); setSelectedSeason(null); setFilters({}); setSearch(''); };
  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || search;

  return (
    <AppLayout>
      <PageHeader 
        title={t('wardrobe.title')} 
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsGridView(!isGridView)} className="active:animate-press">
              {isGridView ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
            </Button>
            {!isSelecting ? (
              <Button variant="ghost" size="sm" onClick={() => setIsSelecting(true)}>{t('wardrobe.select')}</Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}>{t('common.cancel')}</Button>
            )}
          </div>
        }
      />
      
      <div className="p-4 space-y-4">
        {newGarments.length > 0 && showQuickEdit && (
          <QuickEditPanel garments={newGarments} onClose={() => setShowQuickEdit(false)} />
        )}

        {newGarments.length > 0 && !showQuickEdit && (
          <Card className="bg-primary/5 border-primary/20 animate-fade-in">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">{newGarments.length} {t('wardrobe.new_garments')}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowQuickEdit(true)} className="active:animate-press">
                {t('wardrobe.quick_edit')}
              </Button>
            </CardContent>
          </Card>
        )}

        {isOverLimit && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">{t('wardrobe.limit_reached')} ({PLAN_LIMITS.free.maxGarments})</span>
              <Button variant="outline" size="sm" className="ml-2 shrink-0 active:animate-press" onClick={() => setShowPaywall(true)}>
                <Crown className="w-4 h-4 mr-1" />{t('wardrobe.upgrade')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('wardrobe.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 active:animate-press"><SlidersHorizontal className="w-4 h-4" /></Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh]">
              <SheetHeader><SheetTitle>{t('wardrobe.filter')}</SheetTitle></SheetHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>{t('wardrobe.sort')}</Label>
                  <Select value={filters.sortBy || 'created_at'} onValueChange={(value) => handleFilterChange('sortBy', value as GarmentFilters['sortBy'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (<SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('wardrobe.color')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorFilters.map((color) => (
                      <Chip key={color} selected={selectedColor === color} onClick={() => setSelectedColor(selectedColor === color ? null : color)} className="capitalize active:animate-chip-select">{color}</Chip>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('wardrobe.season')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {seasonFilters.map((season) => (
                      <Chip key={season} selected={selectedSeason === season} onClick={() => setSelectedSeason(selectedSeason === season ? null : season)} className="capitalize active:animate-chip-select">{season}</Chip>
                    ))}
                  </div>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="w-full active:animate-press">
                    <X className="w-4 h-4 mr-2" />{t('wardrobe.clear')}
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4">
          {categories.map((category) => (
            <Chip key={category.id} selected={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)} className="shrink-0 active:animate-chip-select">
              {category.label}
            </Chip>
          ))}
        </div>

        {isSelecting && selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg animate-slide-in-bottom">
            <span className="text-sm font-medium">{selectedIds.size} {t('wardrobe.selected')}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkLaundry} className="active:animate-press">
                <WashingMachine className="w-4 h-4 mr-1" />{t('wardrobe.laundry')}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="active:animate-press">
                <Trash2 className="w-4 h-4 mr-1" />{t('wardrobe.remove')}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : displayGarments.length > 0 ? (
          <div className={cn(isGridView ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2')}>
            {displayGarments.map((garment, index) => (
              <div key={garment.id} className="animate-drape-in" style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, animationFillMode: 'both' }}>
                <GarmentCard garment={garment} isGridView={isGridView} isSelecting={isSelecting} isSelected={selectedIds.has(garment.id)} isNew={isNewGarment(garment)} onSelect={() => toggleSelect(garment.id)} onLaundry={() => handleToggleLaundry(garment)} t={t} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Shirt}
            title={hasActiveFilters ? t('wardrobe.no_results') : t('wardrobe.no_garments')}
            description={hasActiveFilters ? t('wardrobe.try_other') : t('wardrobe.add_first')}
            action={!hasActiveFilters ? { label: t('wardrobe.add'), onClick: handleAddGarment, icon: Plus } : undefined}
          />
        )}

        <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-3">
          <Button size="lg" variant="outline" className="h-14 w-14 rounded-full shadow-lg active:animate-press bg-card border-border" onClick={() => navigate('/wardrobe/scan')} aria-label="Live Scan">
            <ScanLine className="w-6 h-6" />
          </Button>
          <Button size="lg" className={cn("h-14 w-14 rounded-full shadow-lg active:animate-press", isOverLimit && "opacity-50")} onClick={handleAddGarment}>
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </AppLayout>
  );
}
