import { Loader2, RefreshCw, Sparkles, X } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageIntro } from '@/components/ui/page-intro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  categories,
  CATEGORY_I18N,
  COLOR_I18N,
  colors,
  FIT_I18N,
  fits,
  MATERIAL_I18N,
  materials,
  PATTERN_I18N,
  patterns,
  seasons,
  SEASON_I18N,
  subcategories,
  SUBCATEGORY_I18N,
} from '@/hooks/useAddGarment';

interface FormStepProps {
  t: (key: string) => string;
  imagePreview: string | null;
  aiAnalysis: unknown;
  storagePath: string | null;
  isAnalyzing: boolean;
  isLoading: boolean;
  title: string;
  category: string;
  subcategory: string;
  colorPrimary: string;
  colorSecondary: string;
  pattern: string;
  material: string;
  fit: string;
  selectedSeasons: string[];
  formality: number[];
  inLaundry: boolean;
  onReset: () => void;
  onReanalyze: () => void;
  onSave: () => void;
  onCancel: () => void;
  setTitle: (value: string) => void;
  setCategory: (value: string) => void;
  setSubcategory: (value: string) => void;
  setColorPrimary: (value: string) => void;
  setColorSecondary: (value: string) => void;
  setPattern: (value: string) => void;
  setMaterial: (value: string) => void;
  setFit: (value: string) => void;
  toggleSeason: (value: string) => void;
  setFormality: (value: number[]) => void;
  setInLaundry: (value: boolean) => void;
}

export function FormStep(props: FormStepProps) {
  const {
    t,
    imagePreview,
    aiAnalysis,
    storagePath,
    isAnalyzing,
    isLoading,
    title,
    category,
    subcategory,
    colorPrimary,
    colorSecondary,
    pattern,
    material,
    fit,
    selectedSeasons,
    formality,
    inLaundry,
    onReset,
    onReanalyze,
    onSave,
    onCancel,
    setTitle,
    setCategory,
    setSubcategory,
    setColorPrimary,
    setColorSecondary,
    setPattern,
    setMaterial,
    setFit,
    toggleSeason,
    setFormality,
    setInLaundry,
  } = props;

  return (
    <AppLayout hideNav>
      <PageHeader
        title={t('addgarment.review')}
        subtitle={t('addgarment.form.subtitle')}
        showBack
        actions={storagePath ? (
          <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isAnalyzing} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isAnalyzing && 'animate-spin')} />
            {t('addgarment.reanalyze')}
          </Button>
        ) : undefined}
      />

      <div className="page-shell !px-5 !pb-36 !pt-6 page-cluster">
        {imagePreview ? (
          <Card surface="editorial" className="overflow-hidden p-2">
            <div className="grid gap-5 p-3 sm:grid-cols-[180px,1fr] sm:items-center">
              <div className="relative overflow-hidden rounded-[1.1rem] bg-secondary/60">
                <img src={imagePreview} alt="Preview" className="aspect-square w-full object-contain" />
                <Button variant="secondary" size="icon" className="absolute right-2 top-2" onClick={onReset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <PageIntro
                eyebrow={aiAnalysis ? (
                  <span className="eyebrow-chip !bg-secondary/70 inline-flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    {t('addgarment.ai_analyzed')}
                  </span>
                ) : t('addgarment.form.review_label')}
                title={title || t('addgarment.review')}
                description={t('addgarment.form.description')}
              />
            </div>
          </Card>
        ) : null}

        <div className="surface-secondary divide-y divide-border/30 rounded-[1.25rem]">
          {/* Identity */}
          <div className="space-y-4 px-5 py-6">
            <div className="space-y-2">
              <Label>{t('addgarment.form.title')} *</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('addgarment.form.title_placeholder')} />
            </div>

            <div className="space-y-2">
              <Label>{t('addgarment.form.category')} *</Label>
              <Select value={category} onValueChange={(value) => { setCategory(value); setSubcategory(''); }}>
                <SelectTrigger>
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
                <Label>{t('addgarment.form.subcategory')}</Label>
                <Select value={subcategory} onValueChange={setSubcategory}>
                  <SelectTrigger>
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

          {/* Color */}
          <div className="space-y-4 px-5 py-6">
            <div className="space-y-3">
              <Label>{t('addgarment.form.primary_color')} *</Label>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColorPrimary(item.id)}
                    className={cn(
                      'h-11 w-11 rounded-full border-2 transition-all',
                      colorPrimary === item.id
                        ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background'
                        : 'border-border hover:scale-105',
                    )}
                    style={{ backgroundColor: item.color }}
                    title={t(COLOR_I18N[item.id] || item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t('addgarment.form.secondary_color')}</Label>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setColorSecondary('')}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all',
                    !colorSecondary
                      ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background'
                      : 'border-border',
                  )}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
                {colors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColorSecondary(item.id)}
                    className={cn(
                      'h-11 w-11 rounded-full border-2 transition-all',
                      colorSecondary === item.id
                        ? 'border-foreground ring-2 ring-foreground/20 ring-offset-2 ring-offset-background'
                        : 'border-border hover:scale-105',
                    )}
                    style={{ backgroundColor: item.color }}
                    title={t(COLOR_I18N[item.id] || item.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Construction */}
          <div className="px-5 py-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('addgarment.form.pattern')}</Label>
                <Select value={pattern} onValueChange={setPattern}>
                  <SelectTrigger>
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
                <Label>{t('addgarment.form.material')}</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger>
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
                <Label>{t('addgarment.form.fit')}</Label>
                <Select value={fit} onValueChange={setFit}>
                  <SelectTrigger>
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
          </div>

          {/* Season, Formality & Laundry */}
          <div className="space-y-6 px-5 py-6">
            <div className="space-y-3">
              <Label>{t('addgarment.form.season')}</Label>
              <div className="flex flex-wrap gap-2">
                {seasons.map((season) => (
                  <Badge
                    key={season}
                    variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'}
                    className="cursor-pointer px-4 py-2"
                    onClick={() => toggleSeason(season.toLowerCase())}
                  >
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

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t('addgarment.form.in_laundry')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('addgarment.form.laundry_hint')}</p>
              </div>
              <Switch checked={inLaundry} onCheckedChange={setInLaundry} />
            </div>
          </div>
        </div>
      </div>

      <div className="bottom-safe-nav fixed inset-x-4 z-20">
        <div className="mx-auto max-w-md">
          <div className="action-bar-floating flex gap-2 rounded-[1.25rem] p-3">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button className="flex-1" onClick={onSave} disabled={isLoading || !title || !category || !colorPrimary}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('addgarment.saving')}
                </>
              ) : (
                t('addgarment.save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
