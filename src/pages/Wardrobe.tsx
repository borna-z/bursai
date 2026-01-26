import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Loader2, 
  WashingMachine, 
  AlertTriangle, 
  Crown,
  Star,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
  Check,
  Trash2,
  Tag,
  Shirt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGarments, useUpdateGarment, useDeleteGarment, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useGarmentSignedUrl } from '@/hooks/useStorage';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Chip } from '@/components/ui/chip';

const categories = [
  { id: 'all', label: 'Alla' },
  { id: 'top', label: 'Överdel' },
  { id: 'bottom', label: 'Underdel' },
  { id: 'shoes', label: 'Skor' },
  { id: 'outerwear', label: 'Ytterkläder' },
  { id: 'accessory', label: 'Accessoar' },
  { id: 'dress', label: 'Klänning' },
];

const colorFilters = [
  'svart', 'vit', 'grå', 'marinblå', 'blå', 'röd', 'grön', 'beige', 'brun'
];

const seasonFilters = ['vår', 'sommar', 'höst', 'vinter'];

const sortOptions = [
  { id: 'created_at', label: 'Senast tillagd' },
  { id: 'wear_count', label: 'Mest använd' },
  { id: 'last_worn_at', label: 'Minst använd' },
];

interface GarmentCardProps {
  garment: Garment;
  isGridView: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onFavorite: () => void;
  onLaundry: () => void;
}

function GarmentCard({ 
  garment, 
  isGridView, 
  isSelecting, 
  isSelected, 
  onSelect,
  onFavorite,
  onLaundry 
}: GarmentCardProps) {
  const navigate = useNavigate();
  const { signedUrl, isLoading: imageLoading } = useGarmentSignedUrl(garment.image_path);

  const handleClick = () => {
    if (isSelecting) {
      onSelect();
    } else {
      navigate(`/wardrobe/${garment.id}`);
    }
  };

  if (!isGridView) {
    return (
      <Card
        className={cn(
          'cursor-pointer hover:shadow-md transition-all overflow-hidden',
          garment.in_laundry && 'opacity-60',
          isSelected && 'ring-2 ring-primary'
        )}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3 p-3">
          {isSelecting && (
            <Checkbox checked={isSelected} className="shrink-0" />
          )}
          <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
            {signedUrl ? (
              <img src={signedUrl} alt={garment.title} className="w-full h-full object-cover" />
            ) : imageLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full h-full bg-muted" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{garment.title}</p>
            <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
              {garment.category} • <span className="capitalize">{garment.color_primary}</span>
            </p>
          </div>
          {garment.in_laundry && (
            <WashingMachine className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all overflow-hidden group',
        garment.in_laundry && 'opacity-60',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={handleClick}
    >
      <div className="aspect-square bg-muted relative">
        {signedUrl ? (
          <img src={signedUrl} alt={garment.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {imageLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <Shirt className="w-8 h-8 text-muted-foreground/50" />
            )}
          </div>
        )}
        
        {/* Selection checkbox */}
        {isSelecting && (
          <div className="absolute top-2 left-2">
            <Checkbox checked={isSelected} className="bg-background/80" />
          </div>
        )}

        {/* Quick actions */}
        {!isSelecting && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              className="w-7 h-7 bg-background/80 hover:bg-background"
              onClick={(e) => { e.stopPropagation(); onLaundry(); }}
            >
              <WashingMachine className={cn('w-3.5 h-3.5', garment.in_laundry && 'text-primary')} />
            </Button>
          </div>
        )}

        {/* Laundry badge */}
        {garment.in_laundry && !isSelecting && (
          <div className="absolute bottom-2 left-2">
            <span className="text-[10px] bg-background/90 px-1.5 py-0.5 rounded-full font-medium">
              I tvätt
            </span>
          </div>
        )}
      </div>
      <CardContent className="p-2.5">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {garment.category} • {garment.color_primary}
        </p>
      </CardContent>
    </Card>
  );
}

export default function WardrobePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<GarmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  
  const { data: garments, isLoading } = useGarments({
    ...filters,
    search,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    color: selectedColor || undefined,
    season: selectedSeason || undefined,
  });
  const { canAddGarment, isPremium, subscription } = useSubscription();

  const handleFilterChange = (key: keyof GarmentFilters, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
    }));
  };

  const handleAddGarment = () => {
    if (canAddGarment()) {
      navigate('/wardrobe/add');
    } else {
      setShowPaywall(true);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkLaundry = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => 
          updateGarment.mutateAsync({ id, updates: { in_laundry: true } })
        )
      );
      toast.success(`${selectedIds.size} plagg markerade i tvätt`);
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => deleteGarment.mutateAsync(id))
      );
      toast.success(`${selectedIds.size} plagg borttagna`);
      setSelectedIds(new Set());
      setIsSelecting(false);
    } catch {
      toast.error('Något gick fel');
    }
  };

  const handleToggleLaundry = async (garment: Garment) => {
    try {
      await updateGarment.mutateAsync({
        id: garment.id,
        updates: { in_laundry: !garment.in_laundry }
      });
      toast.success(garment.in_laundry ? 'Plagget är tillgängligt' : 'Markerat i tvätt');
    } catch {
      toast.error('Något gick fel');
    }
  };

  const currentCount = subscription?.garments_count || 0;
  const isOverLimit = !isPremium && currentCount >= PLAN_LIMITS.free.maxGarments;

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedColor(null);
    setSelectedSeason(null);
    setFilters({});
    setSearch('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedColor || selectedSeason || search;

  return (
    <AppLayout>
      <PageHeader 
        title="Garderob" 
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGridView(!isGridView)}
            >
              {isGridView ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
            </Button>
            {!isSelecting ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelecting(true)}
              >
                Välj
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
              >
                Avbryt
              </Button>
            )}
          </div>
        }
      />
      
      <div className="p-4 space-y-4">
        {/* Over Limit Banner */}
        {isOverLimit && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                Du har nått gränsen ({PLAN_LIMITS.free.maxGarments} plagg)
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2 shrink-0"
                onClick={() => setShowPaywall(true)}
              >
                <Crown className="w-4 h-4 mr-1" />
                Uppgradera
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Sök plagg…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Filter & Sortering</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label>Sortera efter</Label>
                  <Select
                    value={filters.sortBy || 'created_at'}
                    onValueChange={(value) => handleFilterChange('sortBy', value as GarmentFilters['sortBy'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Färg</Label>
                  <div className="flex flex-wrap gap-2">
                    {colorFilters.map((color) => (
                      <Chip
                        key={color}
                        selected={selectedColor === color}
                        onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                        className="capitalize"
                      >
                        {color}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Säsong</Label>
                  <div className="flex flex-wrap gap-2">
                    {seasonFilters.map((season) => (
                      <Chip
                        key={season}
                        selected={selectedSeason === season}
                        onClick={() => setSelectedSeason(selectedSeason === season ? null : season)}
                        className="capitalize"
                      >
                        {season}
                      </Chip>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters} className="w-full">
                    <X className="w-4 h-4 mr-2" />
                    Rensa filter
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4">
          {categories.map((category) => (
            <Chip
              key={category.id}
              selected={selectedCategory === category.id}
              onClick={() => setSelectedCategory(category.id)}
              className="shrink-0"
            >
              {category.label}
            </Chip>
          ))}
        </div>

        {/* Bulk Actions Bar */}
        {isSelecting && selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selectedIds.size} valda</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkLaundry}>
                <WashingMachine className="w-4 h-4 mr-1" />
                Tvätt
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="w-4 h-4 mr-1" />
                Ta bort
              </Button>
            </div>
          </div>
        )}

        {/* Grid/List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : garments && garments.length > 0 ? (
          <div className={cn(
            isGridView 
              ? 'grid grid-cols-2 gap-3' 
              : 'flex flex-col gap-2'
          )}>
            {garments.map((garment) => (
              <GarmentCard 
                key={garment.id} 
                garment={garment}
                isGridView={isGridView}
                isSelecting={isSelecting}
                isSelected={selectedIds.has(garment.id)}
                onSelect={() => toggleSelect(garment.id)}
                onFavorite={() => {}}
                onLaundry={() => handleToggleLaundry(garment)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Shirt}
            title={hasActiveFilters ? 'Inga plagg hittades' : 'Inga plagg än'}
            description={
              hasActiveFilters 
                ? 'Prova ändra sökning eller filter' 
                : 'Lägg till ditt första plagg för att komma igång!'
            }
            action={
              !hasActiveFilters 
                ? { label: 'Lägg till plagg', onClick: handleAddGarment, icon: Plus }
                : undefined
            }
          />
        )}

        {/* FAB */}
        <Button
          size="lg"
          className={cn(
            "fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-30",
            isOverLimit && "opacity-50"
          )}
          onClick={handleAddGarment}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        reason="garments" 
      />
    </AppLayout>
  );
}
