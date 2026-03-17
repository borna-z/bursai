import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useGarment, useUpdateGarment } from '@/hooks/useGarments';
import { LazyImage } from '@/components/ui/lazy-image';
import { PageHeader } from '@/components/layout/PageHeader';
import { useLanguage } from '@/contexts/LanguageContext';

const CATEGORY_IDS = ['top', 'bottom', 'shoes', 'outerwear', 'accessory', 'dress'] as const;
const PATTERN_IDS = ['solid', 'striped', 'checked', 'dotted', 'floral', 'patterned', 'camo'] as const;
const MATERIAL_IDS = ['cotton', 'polyester', 'linen', 'denim', 'leather', 'wool', 'silk', 'synthetic'] as const;
const FIT_IDS = ['slim', 'regular', 'loose', 'oversized'] as const;
const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

const CATEGORY_I18N: Record<string, string> = {
  top: 'garment.category.top', bottom: 'garment.category.bottom', shoes: 'garment.category.shoes',
  outerwear: 'garment.category.outerwear', accessory: 'garment.category.accessory', dress: 'garment.category.dress',
};
const PATTERN_I18N: Record<string, string> = {
  solid: 'garment.pattern.solid', striped: 'garment.pattern.striped', checked: 'garment.pattern.checked',
  dotted: 'garment.pattern.dotted', floral: 'garment.pattern.floral', patterned: 'garment.pattern.patterned', camo: 'garment.pattern.camo',
};
const MATERIAL_I18N: Record<string, string> = {
  cotton: 'garment.material.cotton', polyester: 'garment.material.polyester', linen: 'garment.material.linen',
  denim: 'garment.material.denim', leather: 'garment.material.leather', wool: 'garment.material.wool', silk: 'garment.material.silk', synthetic: 'garment.material.synthetic',
};
const FIT_I18N: Record<string, string> = {
  slim: 'garment.fit.slim', regular: 'garment.fit.regular', loose: 'garment.fit.loose', oversized: 'garment.fit.oversized',
};
const SEASON_I18N: Record<string, string> = {
  spring: 'garment.season.spring', summer: 'garment.season.summer', autumn: 'garment.season.autumn', winter: 'garment.season.winter',
};
const COLOR_I18N: Record<string, string> = {
  black: 'color.black', white: 'color.white', grey: 'color.grey', navy: 'color.navy',
  blue: 'color.blue', red: 'color.red', green: 'color.green', beige: 'color.beige',
  brown: 'color.brown', pink: 'color.pink', yellow: 'color.yellow', orange: 'color.orange', purple: 'color.purple',
};
const SUBCATEGORY_I18N: Record<string, string> = {
  't-shirt': 'subcategory.tshirt', 'shirt': 'subcategory.shirt', 'blouse': 'subcategory.blouse',
  'sweater': 'subcategory.sweater', 'hoodie': 'subcategory.hoodie', 'polo': 'subcategory.polo',
  'tank': 'subcategory.tank', 'cardigan': 'subcategory.cardigan',
  'jeans': 'subcategory.jeans', 'chinos': 'subcategory.chinos', 'shorts': 'subcategory.shorts',
  'skirt': 'subcategory.skirt', 'dress_pants': 'subcategory.dress_pants', 'joggers': 'subcategory.joggers', 'leggings': 'subcategory.leggings',
  'sneakers': 'subcategory.sneakers', 'loafers': 'subcategory.loafers', 'boots': 'subcategory.boots',
  'sandals': 'subcategory.sandals', 'heels': 'subcategory.heels', 'trainers': 'subcategory.trainers',
  'jacket': 'subcategory.jacket', 'coat': 'subcategory.coat', 'blazer': 'subcategory.blazer',
  'vest': 'subcategory.vest', 'rain_jacket': 'subcategory.rain_jacket', 'down_jacket': 'subcategory.down_jacket',
  'bag': 'subcategory.bag', 'scarf': 'subcategory.scarf', 'beanie': 'subcategory.beanie',
  'belt': 'subcategory.belt', 'jewelry': 'subcategory.jewelry', 'sunglasses': 'subcategory.sunglasses',
  'casual_dress': 'subcategory.casual_dress', 'party_dress': 'subcategory.party_dress',
  'maxi_dress': 'subcategory.maxi_dress', 'mini_dress': 'subcategory.mini_dress',
};

const subcategories: Record<string, string[]> = {
  top: ['T-shirt', 'Shirt', 'Blouse', 'Sweater', 'Hoodie', 'Polo', 'Tank', 'Cardigan'],
  bottom: ['Jeans', 'Chinos', 'Shorts', 'Skirt', 'Dress_pants', 'Joggers', 'Leggings'],
  shoes: ['Sneakers', 'Loafers', 'Boots', 'Sandals', 'Heels', 'Trainers'],
  outerwear: ['Jacket', 'Coat', 'Blazer', 'Vest', 'Rain_jacket', 'Down_jacket'],
  accessory: ['Bag', 'Scarf', 'Beanie', 'Belt', 'Jewelry', 'Sunglasses'],
  dress: ['Casual_dress', 'Party_dress', 'Maxi_dress', 'Mini_dress'],
};

const colors = [
  { id: 'black', color: 'hsl(0 0% 0%)' },
  { id: 'white', color: 'hsl(0 0% 100%)' },
  { id: 'grey', color: 'hsl(0 0% 50%)' },
  { id: 'navy', color: 'hsl(220 70% 25%)' },
  { id: 'blue', color: 'hsl(210 100% 50%)' },
  { id: 'red', color: 'hsl(0 100% 50%)' },
  { id: 'green', color: 'hsl(120 60% 40%)' },
  { id: 'beige', color: 'hsl(40 40% 75%)' },
  { id: 'brown', color: 'hsl(30 50% 30%)' },
  { id: 'pink', color: 'hsl(350 80% 70%)' },
  { id: 'yellow', color: 'hsl(50 100% 50%)' },
  { id: 'orange', color: 'hsl(30 100% 50%)' },
  { id: 'purple', color: 'hsl(280 60% 50%)' },
];

const categories = CATEGORY_IDS.map(id => ({ id, label: id }));
const patterns = PATTERN_IDS.map(id => id);
const materials = MATERIAL_IDS.map(id => id);
const fits = FIT_IDS.map(id => id);
const seasons = SEASON_IDS.map(id => id);

export default function EditGarmentPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: garment, isLoading } = useGarment(id);
  const updateGarment = useUpdateGarment();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [colorPrimary, setColorPrimary] = useState('');
  const [colorSecondary, setColorSecondary] = useState('');
  const [pattern, setPattern] = useState('');
  const [material, setMaterial] = useState('');
  const [fit, setFit] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [formality, setFormality] = useState([3]);
  const [inLaundry, setInLaundry] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form when garment loads
  useEffect(() => {
    if (garment && !initialized) {
      setTitle(garment.title);
      setCategory(garment.category);
      setSubcategory(garment.subcategory || '');
      setColorPrimary(garment.color_primary);
      setColorSecondary(garment.color_secondary || '');
      setPattern(garment.pattern || '');
      setMaterial(garment.material || '');
      setFit(garment.fit || '');
      setSelectedSeasons(garment.season_tags || []);
      setFormality([garment.formality || 3]);
      setInLaundry(garment.in_laundry || false);
      setInitialized(true);
    }
  }, [garment, initialized]);

  const toggleSeason = (season: string) => {
    setSelectedSeasons((prev) =>
      prev.includes(season) ? prev.filter((s) => s !== season) : [...prev, season]
    );
  };

  const handleSave = async () => {
    if (!id || !title || !category || !colorPrimary) {
      toast.error(t('addgarment.fill_required'));
      return;
    }

    setIsSaving(true);
    try {
      await updateGarment.mutateAsync({
        id,
        updates: {
          title,
          category,
          subcategory: subcategory || null,
          color_primary: colorPrimary,
          color_secondary: colorSecondary || null,
          pattern: pattern || null,
          material: material || null,
          fit: fit || null,
          season_tags: selectedSeasons.length > 0 ? selectedSeasons : null,
          formality: formality[0],
          in_laundry: inLaundry,
        },
      });
      toast.success(t('garment.edit_saved'));
      navigate(`/wardrobe/${id}`);
    } catch {
      toast.error(t('common.something_wrong'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="p-4 flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-32 h-6" />
          </div>
        </div>
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Skeleton className="aspect-square max-w-xs mx-auto rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!garment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg font-medium mb-4">{t('garment.not_found')}</p>
        <Button variant="outline" onClick={() => navigate('/wardrobe')}>{t('common.back')}</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title={t('garment.edit_title')} showBack />

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* Image (read-only) */}
        <LazyImage imagePath={garment.image_path} alt={garment.title} aspectRatio="square" className="max-w-xs mx-auto rounded-xl overflow-hidden" />

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('addgarment.form.title')} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('addgarment.form.title_placeholder')} />
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.category')} *</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(''); }}>
              <SelectTrigger><SelectValue placeholder={t('addgarment.form.select_category')} /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{t(CATEGORY_I18N[cat.id] || cat.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category && subcategories[category] && (
            <div className="space-y-2">
              <Label>{t('addgarment.form.subcategory')}</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger><SelectValue placeholder={t('addgarment.form.select_subcategory')} /></SelectTrigger>
                <SelectContent>
                  {subcategories[category].map((sub) => (
                    <SelectItem key={sub} value={sub.toLowerCase()}>{t(SUBCATEGORY_I18N[sub.toLowerCase()] || sub)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('addgarment.form.primary_color')} *</Label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => setColorPrimary(c.id)}
                  className={cn('w-10 h-10 rounded-full border-2 transition-all', colorPrimary === c.id ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'border-border hover:scale-110')}
                  style={{ backgroundColor: c.color }} title={t(COLOR_I18N[c.id] || c.id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.secondary_color')}</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setColorSecondary('')}
                className={cn('w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center', !colorSecondary ? 'ring-2 ring-primary ring-offset-2' : 'border-border')}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              {colors.map((c) => (
                <button key={c.id} type="button" onClick={() => setColorSecondary(c.id)}
                  className={cn('w-10 h-10 rounded-full border-2 transition-all', colorSecondary === c.id ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'border-border hover:scale-110')}
                  style={{ backgroundColor: c.color }} title={t(COLOR_I18N[c.id] || c.id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.pattern')}</Label>
            <Select value={pattern} onValueChange={setPattern}>
              <SelectTrigger><SelectValue placeholder={t('addgarment.form.select_pattern')} /></SelectTrigger>
              <SelectContent>
                {patterns.map((p) => (<SelectItem key={p} value={p.toLowerCase()}>{t(PATTERN_I18N[p.toLowerCase()] || p)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.material')}</Label>
            <Select value={material} onValueChange={setMaterial}>
              <SelectTrigger><SelectValue placeholder={t('addgarment.form.select_material')} /></SelectTrigger>
              <SelectContent>
                {materials.map((m) => (<SelectItem key={m} value={m.toLowerCase()}>{t(MATERIAL_I18N[m.toLowerCase()] || m)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.fit')}</Label>
            <Select value={fit} onValueChange={setFit}>
              <SelectTrigger><SelectValue placeholder={t('addgarment.form.select_fit')} /></SelectTrigger>
              <SelectContent>
                {fits.map((f) => (<SelectItem key={f} value={f.toLowerCase()}>{t(FIT_I18N[f.toLowerCase()] || f)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('addgarment.form.season')}</Label>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <Badge key={season} variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'}
                  className="cursor-pointer px-4 py-2" onClick={() => toggleSeason(season.toLowerCase())}>
                  {t(SEASON_I18N[season.toLowerCase()] || season)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('addgarment.form.formality')}</Label>
              <span className="text-sm text-muted-foreground">{formality[0]} / 5</span>
            </div>
            <Slider value={formality} onValueChange={setFormality} max={5} min={1} step={1} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('addgarment.form.casual')}</span>
              <span>{t('addgarment.form.formal')}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <Label>{t('addgarment.form.in_laundry')}</Label>
            <Switch checked={inLaundry} onCheckedChange={setInLaundry} />
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-3 max-w-lg mx-auto">
        <Button variant="outline" className="flex-1" onClick={() => navigate(-1)} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={isSaving || !title || !category || !colorPrimary}>
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('addgarment.saving')}</>
          ) : (
            t('garment.edit_save')
          )}
        </Button>
      </div>
    </div>
  );
}
