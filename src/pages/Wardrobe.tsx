import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Loader2, WashingMachine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useGarments, type GarmentFilters, type Garment } from '@/hooks/useGarments';
import { useStorage } from '@/hooks/useStorage';
import { AppLayout } from '@/components/layout/AppLayout';

const categories = [
  { id: 'all', label: 'Alla' },
  { id: 'top', label: 'Överdel' },
  { id: 'bottom', label: 'Underdel' },
  { id: 'shoes', label: 'Skor' },
  { id: 'outerwear', label: 'Ytterkläder' },
  { id: 'accessory', label: 'Accessoar' },
  { id: 'dress', label: 'Klänning' },
];

const sortOptions = [
  { id: 'created_at', label: 'Nyligen tillagda' },
  { id: 'last_worn_at', label: 'Senast använda' },
  { id: 'wear_count', label: 'Mest använda' },
];

function GarmentCard({ garment }: { garment: Garment }) {
  const navigate = useNavigate();
  const { getGarmentSignedUrl } = useStorage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (garment.image_path) {
      getGarmentSignedUrl(garment.image_path).then(setImageUrl).catch(() => {});
    }
  }, [garment.image_path]);

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all overflow-hidden',
        garment.in_laundry && 'opacity-60'
      )}
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <div className="aspect-square bg-secondary relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={garment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-muted" />
          </div>
        )}
        {garment.in_laundry && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-1">
              <WashingMachine className="w-3 h-3" />
              I tvätt
            </Badge>
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <p className="font-medium text-sm truncate">{garment.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{garment.category}</p>
      </CardContent>
    </Card>
  );
}

export default function WardrobePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<GarmentFilters>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: garments, isLoading } = useGarments({
    ...filters,
    search,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
  });

  const handleFilterChange = (key: keyof GarmentFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? undefined : value,
    }));
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Header */}
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
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
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
                    onValueChange={(value) => handleFilterChange('sortBy', value as any)}
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

                <div className="flex items-center justify-between">
                  <Label>Visa endast i tvätt</Label>
                  <Switch
                    checked={filters.inLaundry === true}
                    onCheckedChange={(checked) =>
                      handleFilterChange('inLaundry', checked ? true : undefined)
                    }
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {categories.map((category) => (
            <Badge
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2 text-sm whitespace-nowrap"
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </Badge>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : garments && garments.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {garments.map((garment) => (
              <GarmentCard key={garment.id} garment={garment} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">
              {search || selectedCategory !== 'all'
                ? 'Inga plagg hittades'
                : 'Inga plagg än'}
            </p>
            <p className="text-muted-foreground mt-1">
              {search || selectedCategory !== 'all'
                ? 'Prova ändra sökning eller filter'
                : 'Lägg till ditt första plagg!'}
            </p>
          </div>
        )}

        {/* FAB */}
        <Button
          size="lg"
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
          onClick={() => navigate('/wardrobe/add')}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </AppLayout>
  );
}
