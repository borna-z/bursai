import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { AnimatedPage } from '@/components/ui/animated-page';
import { hapticLight } from '@/lib/haptics';
import { EASE_CURVE, STAGGER_DELAY, DURATION_MEDIUM, DISTANCE } from '@/lib/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LazyImage } from '@/components/ui/lazy-image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGarment, useUpdateGarment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { cn } from '@/lib/utils';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

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
  't-shirt': 'subcategory.tshirt', shirt: 'subcategory.shirt', blouse: 'subcategory.blouse',
  sweater: 'subcategory.sweater', hoodie: 'subcategory.hoodie', polo: 'subcategory.polo',
  tank: 'subcategory.tank', cardigan: 'subcategory.cardigan',
  jeans: 'subcategory.jeans', chinos: 'subcategory.chinos', shorts: 'subcategory.shorts',
  skirt: 'subcategory.skirt', dress_pants: 'subcategory.dress_pants', joggers: 'subcategory.joggers', leggings: 'subcategory.leggings',
  sneakers: 'subcategory.sneakers', loafers: 'subcategory.loafers', boots: 'subcategory.boots',
  sandals: 'subcategory.sandals', heels: 'subcategory.heels', trainers: 'subcategory.trainers',
  jacket: 'subcategory.jacket', coat: 'subcategory.coat', blazer: 'subcategory.blazer',
  vest: 'subcategory.vest', rain_jacket: 'subcategory.rain_jacket', down_jacket: 'subcategory.down_jacket',
  bag: 'subcategory.bag', scarf: 'subcategory.scarf', beanie: 'subcategory.beanie',
  belt: 'subcategory.belt', jewelry: 'subcategory.jewelry', sunglasses: 'subcategory.sunglasses',
  casual_dress: 'subcategory.casual_dress', party_dress: 'subcategory.party_dress',
  maxi_dress: 'subcategory.maxi_dress', mini_dress: 'subcategory.mini_dress',
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

const categories = CATEGORY_IDS.map((id) => ({ id, label: id }));
const patterns = PATTERN_IDS.map((id) => id);
const materials = MATERIAL_IDS.map((id) => id);
const fits = FIT_IDS.map((id) => id);
const seasons = SEASON_IDS.map((id) => id);

/* ── Motion helpers ── */
const sectionTransition = (i: number) => ({
  duration: DURATION_MEDIUM,
  ease: EASE_CURVE,
  delay: i * STAGGER_DELAY * 2,
});

export default function EditGarmentPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: garment, isLoading } = useGarment(id);
  const updateGarment = useUpdateGarment();
  const prefersReduced = useReducedMotion();

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
    setSelectedSeasons((current) =>
      current.includes(season)
        ? current.filter((item) => item !== season)
        : [...current, season],
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

  /* ── Shared motion props ── */
  const reveal = (i: number) =>
    prefersReduced
      ? {}
      : {
          initial: { opacity: 0, y: DISTANCE.md },
          animate: { opacity: 1, y: 0 },
          transition: sectionTransition(i),
        };

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <AppLayout hideNav>
        <PageHeader title={t('garment.edit_title')} showBack />
        <div className="page-shell !px-5 !pt-6 page-cluster">
          <Skeleton className="h-72 rounded-[1.25rem]" />
          <Skeleton className="h-64 rounded-[1.25rem]" />
          <Skeleton className="h-56 rounded-[1.25rem]" />
        </div>
      </AppLayout>
    );
  }

  /* ── Not found ── */
  if (!garment) {
    return (
      <AppLayout hideNav>
        <PageHeader title={t('garment.edit_title')} showBack />
        <div className="page-shell !px-5 !pt-6">
          <div className="surface-secondary rounded-[1.25rem] p-6 text-center">
            <h2 className="font-display italic text-lg">{t('garment.not_found')}</h2>
            <Button
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => { hapticLight(); navigate('/wardrobe'); }}
            >
              {t('common.back')}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('garment.edit_title')}
        showBack
        titleClassName="font-display italic"
      />

      <AnimatedPage className="page-shell !px-5 !pb-36 !pt-4 page-cluster">
        {/* ── Hero image card ── */}
        <motion.div {...reveal(0)} className="surface-secondary rounded-[1.25rem] overflow-hidden">
          <div className="relative aspect-[4/5] max-h-[380px] overflow-hidden">
            <LazyImage
              imagePath={getPreferredGarmentImagePath(garment)}
              alt={garment.title}
              aspectRatio="portrait"
              className="w-full h-full object-cover"
            />
            <RenderPendingOverlay renderStatus={garment.render_status} />
            {/* Gradient overlay for title */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h2 className="font-display italic text-[1.5rem] leading-tight text-white drop-shadow-sm">
                {garment.title}
              </h2>
            </div>
          </div>
        </motion.div>

        {/* ── Item Identity ── */}
        <motion.section {...reveal(1)} className="surface-secondary rounded-[1.25rem] p-5 space-y-5">
          <div className="space-y-1">
            <p className="label-editorial text-muted-foreground/50">Item Identity</p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label className="font-body text-sm">{t('addgarment.form.title')} *</Label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('addgarment.form.title_placeholder')}
                className="rounded-[0.75rem]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-body text-sm">{t('addgarment.form.category')} *</Label>
                <Select value={category} onValueChange={(value) => { hapticLight(); setCategory(value); setSubcategory(''); }}>
                  <SelectTrigger className="rounded-[0.75rem]">
                    <SelectValue placeholder={t('addgarment.form.select_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {t(CATEGORY_I18N[item.id] || item.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {category && subcategories[category] ? (
                <div className="space-y-2">
                  <Label className="font-body text-sm">{t('addgarment.form.subcategory')}</Label>
                  <Select value={subcategory} onValueChange={(v) => { hapticLight(); setSubcategory(v); }}>
                    <SelectTrigger className="rounded-[0.75rem]">
                      <SelectValue placeholder={t('addgarment.form.select_subcategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories[category].map((item) => (
                        <SelectItem key={item} value={item.toLowerCase()}>
                          {t(SUBCATEGORY_I18N[item.toLowerCase()] || item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          </div>
        </motion.section>

        {/* ── Color Story ── */}
        <motion.section {...reveal(2)} className="surface-secondary rounded-[1.25rem] p-5 space-y-5">
          <div className="space-y-1">
            <p className="label-editorial text-muted-foreground/50">Dominant Color</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="font-body text-sm">{t('addgarment.form.primary_color')} *</Label>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { hapticLight(); setColorPrimary(item.id); }}
                    className={cn(
                      'h-10 w-10 rounded-full border-2 transition-all',
                      colorPrimary === item.id
                        ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background scale-110'
                        : 'border-border/40 hover:scale-105',
                    )}
                    style={{ backgroundColor: item.color }}
                    title={t(COLOR_I18N[item.id] || item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-body text-sm">{t('addgarment.form.secondary_color')}</Label>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => { hapticLight(); setColorSecondary(''); }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    !colorSecondary
                      ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background'
                      : 'border-border/40',
                  )}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>

                {colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { hapticLight(); setColorSecondary(item.id); }}
                    className={cn(
                      'h-10 w-10 rounded-full border-2 transition-all',
                      colorSecondary === item.id
                        ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background scale-110'
                        : 'border-border/40 hover:scale-105',
                    )}
                    style={{ backgroundColor: item.color }}
                    title={t(COLOR_I18N[item.id] || item.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Construction ── */}
        <motion.section {...reveal(3)} className="surface-secondary rounded-[1.25rem] p-5 space-y-5">
          <div className="space-y-1">
            <p className="label-editorial text-muted-foreground/50">Material Composition</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="font-body text-sm">{t('addgarment.form.pattern')}</Label>
              <Select value={pattern} onValueChange={(v) => { hapticLight(); setPattern(v); }}>
                <SelectTrigger className="rounded-[0.75rem]">
                  <SelectValue placeholder={t('addgarment.form.select_pattern')} />
                </SelectTrigger>
                <SelectContent>
                  {patterns.map((item) => (
                    <SelectItem key={item} value={item.toLowerCase()}>
                      {t(PATTERN_I18N[item.toLowerCase()] || item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">{t('addgarment.form.material')}</Label>
              <Select value={material} onValueChange={(v) => { hapticLight(); setMaterial(v); }}>
                <SelectTrigger className="rounded-[0.75rem]">
                  <SelectValue placeholder={t('addgarment.form.select_material')} />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((item) => (
                    <SelectItem key={item} value={item.toLowerCase()}>
                      {t(MATERIAL_I18N[item.toLowerCase()] || item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-body text-sm">{t('addgarment.form.fit')}</Label>
              <Select value={fit} onValueChange={(v) => { hapticLight(); setFit(v); }}>
                <SelectTrigger className="rounded-[0.75rem]">
                  <SelectValue placeholder={t('addgarment.form.select_fit')} />
                </SelectTrigger>
                <SelectContent>
                  {fits.map((item) => (
                    <SelectItem key={item} value={item.toLowerCase()}>
                      {t(FIT_I18N[item.toLowerCase()] || item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.section>

        {/* ── Seasonal Utility ── */}
        <motion.section {...reveal(4)} className="surface-secondary rounded-[1.25rem] p-5 space-y-5">
          <div className="space-y-1">
            <p className="label-editorial text-muted-foreground/50">Seasonal Utility</p>
          </div>

          <div className="space-y-3">
            <Label className="font-body text-sm">{t('addgarment.form.season')}</Label>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => (
                <Badge
                  key={season}
                  variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'}
                  className="cursor-pointer rounded-full px-4 py-2 font-body text-sm transition-all"
                  onClick={() => { hapticLight(); toggleSeason(season.toLowerCase()); }}
                >
                  {t(SEASON_I18N[season.toLowerCase()] || season)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="font-body text-sm">{t('addgarment.form.formality')}</Label>
              <span className="text-sm font-body text-muted-foreground">{formality[0]} / 5</span>
            </div>
            <Slider value={formality} onValueChange={setFormality} max={5} min={1} step={1} />
            <div className="flex justify-between text-xs font-body text-muted-foreground">
              <span>{t('addgarment.form.casual')}</span>
              <span>{t('addgarment.form.formal')}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[1rem] border border-border/40 bg-background/60 px-4 py-4">
            <div>
              <p className="text-sm font-medium font-body text-foreground">{t('addgarment.form.in_laundry')}</p>
              <p className="mt-1 text-xs font-body text-muted-foreground/70">Hide from outfit creation until ready.</p>
            </div>
            <Switch checked={inLaundry} onCheckedChange={(v) => { hapticLight(); setInLaundry(v); }} />
          </div>
        </motion.section>
      </AnimatedPage>

      {/* ── Floating action bar ── */}
      <div className="bottom-safe-nav fixed inset-x-4 z-20">
        <div className="mx-auto max-w-md">
          <div className="action-bar-floating flex gap-3 rounded-[1.25rem] p-3">
            <Button
              variant="outline"
              className="flex-1 rounded-full font-body"
              onClick={() => { hapticLight(); navigate(-1); }}
              disabled={isSaving}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1 rounded-full font-body"
              onClick={() => { hapticLight(); handleSave(); }}
              disabled={isSaving || !title || !category || !colorPrimary}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('addgarment.saving')}
                </>
              ) : (
                t('garment.edit_save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
