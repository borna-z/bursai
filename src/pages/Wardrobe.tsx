import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Loader2, WashingMachine,
  Grid3X3, List, X, Trash2, Shirt, ScanLine, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGarments, useUpdateGarment, useDeleteGarment, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { SettingsGroup } from '@/components/settings/SettingsGroup';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';

const colorFilters = ['svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'];
const seasonFilters = ['vår', 'sommar', 'höst', 'vinter'];

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

function GarmentCard({ garment, isGridView, isSelecting, isSelected, onSelect }: GarmentCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (isSelecting) { onSelect(); } else { navigate(`/wardrobe/${garment.id}`); }
  };

  if (!isGridView) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 bg-card rounded-xl transition-all active:scale-[0.99] text-left',
          garment.in_laundry && 'opacity-60',
          isSelected && 'ring-2 ring-accent'
        )}
      >
        {isSelecting && <Checkbox checked={isSelected} className="shrink-0" />}
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-14 h-14 rounded-lg shrink-0"
          fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{garment.title}</p>
          <p className="text-xs text-muted-foreground capitalize">{garment.category} · {garment.color_primary}</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full bg-card rounded-xl overflow-hidden transition-all active:scale-[0.98] text-left',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-accent'
      )}
    >
      <div className="aspect-square bg-muted relative">
        <LazyImageSimple
          imagePath={garment.image_path}
          alt={garment.title}
          className="w-full h-full"
          fallbackIcon={<Shirt className="w-8 h-8 text-muted-foreground/50" />}
        />
        {isSelecting && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={isSelected} className="bg-background/80" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category} · {garment.color_primary}</p>
      </div>
    </button>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  
  const queryResult = useGarments({
    ...filters, search: debouncedSearch,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
  });
  const { data: infiniteData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = queryResult;
  const { canAddGarment, isPremium } = useSubscription();

  const displayGarments = useMemo(() => {
    return infiniteData?.pages.flatMap(p => p.items) ?? [];
  }, [infiniteData]);

  // Intersection observer for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const categories = [
    { id: 'all', label: t('wardrobe.all') },
    { id: 'top', label: t('wardrobe.top') },
    { id: 'bottom', label: t('wardrobe.bottom') },
    { id: 'shoes', label: t('wardrobe.shoes') },
    { id: 'outerwear', label: t('wardrobe.outerwear') },
    { id: 'accessory', label: t('wardrobe.accessory') },
    { id: 'dress', label: t('wardrobe.dress') },
    { id: 'underwear', label: t('wardrobe.underwear') },
  ];

  const sortOptions = [
    { id: 'created_at', label: t('wardrobe.sort.latest') },
    { id: 'wear_count', label: t('wardrobe.sort.most_used') },
    { id: 'last_worn_at', label: t('wardrobe.sort.least_used') },
  ];

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

  const isOverLimit = !isPremium && (displayGarments?.length || 0) >= PLAN_LIMITS.free.maxGarments;

  const clearFilters = () => { setSelectedCategory('all'); setSelectedColor(null); setSelectedSeason(null); setFilters({}); setSearch(''); };
  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || search;

  return (
    <AppLayout>
      <PageHeader 
        title={t('wardrobe.title')} 
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsGridView(!isGridView)}>
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
      
      <div className="px-4 pb-36 pt-4 space-y-5 max-w-lg mx-auto">
        {/* Search */}
        <SettingsGroup>
          <Collapsible open={searchOpen} onOpenChange={setSearchOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{search || t('wardrobe.search')}</span>
              </div>
              {searchOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3">
                <Input
                  placeholder={t('wardrobe.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-muted/50 border-0"
                  autoFocus
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SettingsGroup>

        {/* Category grid */}
        <SettingsGroup title={t('wardrobe.category')}>
          <div className="grid grid-cols-4">
            {categories.map((cat, index) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'py-3 text-sm font-medium transition-colors relative',
                  selectedCategory === cat.id
                    ? 'text-accent bg-accent/5'
                    : 'text-foreground hover:bg-muted/50',
                  // borders
                  index % 4 !== 3 && 'border-r border-border/50',
                  index < 4 && 'border-b border-border/50',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </SettingsGroup>

        {/* Filters */}
        <SettingsGroup>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium">{t('wardrobe.filter')}</span>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-accent" />
                )}
                {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                {/* Sort */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.sort')}</span>
                  <Select value={filters.sortBy || 'created_at'} onValueChange={(v) => handleFilterChange('sortBy', v as GarmentFilters['sortBy'])}>
                    <SelectTrigger className="bg-muted/50 border-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.color')}</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {colorFilters.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                        className={cn(
                          'py-2 text-xs rounded-lg capitalize transition-colors',
                          selectedColor === color
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'bg-muted/50 text-foreground hover:bg-muted'
                        )}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Season */}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{t('wardrobe.season')}</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {seasonFilters.map((season) => (
                      <button
                        key={season}
                        onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                        className={cn(
                          'py-2 text-xs rounded-lg capitalize transition-colors',
                          selectedSeason === season
                            ? 'bg-accent/10 text-accent font-medium'
                            : 'bg-muted/50 text-foreground hover:bg-muted'
                        )}
                      >
                        {season}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                    {t('wardrobe.clear')}
                  </button>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </SettingsGroup>

        {/* Count */}
        <p className="text-xs text-muted-foreground px-1">
          {displayGarments.length} {t('wardrobe.garments_count_label')}
        </p>

        {/* Bulk select bar */}
        {isSelecting && selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-card rounded-xl">
            <span className="text-sm font-medium">{selectedIds.size} {t('wardrobe.selected')}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkLaundry} className="rounded-xl">
                <WashingMachine className="w-4 h-4 mr-1" />{t('wardrobe.laundry')}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="rounded-xl">
                <Trash2 className="w-4 h-4 mr-1" />{t('wardrobe.remove')}
              </Button>
            </div>
          </div>
        )}

        {/* Garment grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayGarments.length > 0 ? (
          <>
            <div className={cn(isGridView ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-2')}>
              {displayGarments.map((garment, index) => (
                <div key={garment.id} className="animate-drape-in" style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, animationFillMode: 'both' }}>
                  <GarmentCard
                    garment={garment}
                    isGridView={isGridView}
                    isSelecting={isSelecting}
                    isSelected={selectedIds.has(garment.id)}
                    onSelect={() => toggleSelect(garment.id)}
                  />
                </div>
              ))}
            </div>
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Shirt}
            title={hasActiveFilters ? t('wardrobe.no_results') : t('wardrobe.no_garments')}
            description={hasActiveFilters ? t('wardrobe.try_other') : t('wardrobe.add_first')}
            action={!hasActiveFilters ? { label: t('wardrobe.add'), onClick: handleAddGarment, icon: Plus } : undefined}
          />
        )}

        {/* FABs */}
        <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-3">
          <Button
            size="lg"
            variant="outline"
            className="h-14 w-14 rounded-xl shadow-lg bg-card border-border"
            onClick={() => navigate('/wardrobe/scan')}
            aria-label="Live Scan"
          >
            <ScanLine className="w-6 h-6" />
          </Button>
          <Button
            size="lg"
            className={cn(
              "h-14 w-14 rounded-xl shadow-lg bg-accent text-accent-foreground hover:bg-accent/90",
              isOverLimit && "opacity-50"
            )}
            onClick={handleAddGarment}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} reason="garments" />
    </AppLayout>
  );
}
