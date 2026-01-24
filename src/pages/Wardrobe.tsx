import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Loader2, WashingMachine, AlertTriangle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { useGarmentSignedUrl } from '@/hooks/useStorage';
import { useSubscription, PLAN_LIMITS } from '@/hooks/useSubscription';
import { PaywallModal } from '@/components/PaywallModal';
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
  const { signedUrl, isLoading: imageLoading } = useGarmentSignedUrl(garment.image_path);

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-all overflow-hidden',
        garment.in_laundry && 'opacity-60'
      )}
      onClick={() => navigate(`/wardrobe/${garment.id}`)}
    >
      <div className="aspect-square bg-secondary relative">
        {signedUrl ? (
          <img
            src={signedUrl}
            alt={garment.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {imageLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted" />
            )}
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
  const [showPaywall, setShowPaywall] = useState(false);
  const { data: garments, isLoading } = useGarments({
    ...filters,
    search,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
  });
  const { canAddGarment, isPremium, subscription } = useSubscription();

  const handleFilterChange = (key: keyof GarmentFilters, value: any) => {
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

  // Check if user is over the limit (existing users with >10 garments)
  const currentCount = subscription?.garments_count || 0;
  const isOverLimit = !isPremium && currentCount >= PLAN_LIMITS.free.maxGarments;

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Over Limit Banner */}
        {isOverLimit && (
          <Alert className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Du har nått gränsen för Free ({PLAN_LIMITS.free.maxGarments} plagg). 
                Uppgradera för att lägga till fler.
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
          className={cn(
            "fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg",
            isOverLimit && "opacity-50"
          )}
          onClick={handleAddGarment}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Paywall Modal */}
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        reason="garments" 
      />
    </AppLayout>
  );
}
