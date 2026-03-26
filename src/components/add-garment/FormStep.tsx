import { ArrowLeft, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onReset}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">{t('addgarment.review')}</h1>
          </div>
          {storagePath && (
            <Button variant="outline" size="sm" onClick={onReanalyze} disabled={isAnalyzing} className="gap-2">
              <RefreshCw className={cn('w-4 h-4', isAnalyzing && 'animate-spin')} />
              {t('addgarment.reanalyze')}
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {imagePreview && (
          <div className="relative aspect-square max-w-xs mx-auto overflow-hidden bg-[hsl(36_33%_93%)]">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
            <Button variant="secondary" size="icon" className="absolute top-2 right-2" onClick={onReset}>
              <X className="w-4 h-4" />
            </Button>
            {aiAnalysis && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {t('addgarment.ai_analyzed')}
                </Badge>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2"><Label>{t('addgarment.form.title')} *</Label><Input placeholder={t('addgarment.form.title_placeholder')} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>{t('addgarment.form.category')} *</Label><Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(''); }}><SelectTrigger><SelectValue placeholder={t('addgarment.form.select_category')} /></SelectTrigger><SelectContent>{categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{t(CATEGORY_I18N[cat.id] || cat.id)}</SelectItem>)}</SelectContent></Select></div>
          {category && subcategories[category] && <div className="space-y-2"><Label>{t('addgarment.form.subcategory')}</Label><Select value={subcategory} onValueChange={setSubcategory}><SelectTrigger><SelectValue placeholder={t('addgarment.form.select_subcategory')} /></SelectTrigger><SelectContent>{subcategories[category].map((sub) => <SelectItem key={sub} value={sub.toLowerCase()}>{t(SUBCATEGORY_I18N[sub.toLowerCase()] || sub)}</SelectItem>)}</SelectContent></Select></div>}

          <div className="space-y-2"><Label>{t('addgarment.form.primary_color')} *</Label><div className="flex flex-wrap gap-2">{colors.map((c) => <button key={c.id} type="button" onClick={() => setColorPrimary(c.id)} className={cn('w-10 h-10 rounded-full border-2 transition-all', colorPrimary === c.id ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'border-border hover:scale-110')} style={{ backgroundColor: c.color }} title={t(COLOR_I18N[c.id] || c.id)} />)}</div></div>
          <div className="space-y-2"><Label>{t('addgarment.form.secondary_color')}</Label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setColorSecondary('')} className={cn('w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center', !colorSecondary ? 'ring-2 ring-primary ring-offset-2' : 'border-border')}><X className="w-4 h-4 text-muted-foreground" /></button>{colors.map((c) => <button key={c.id} type="button" onClick={() => setColorSecondary(c.id)} className={cn('w-10 h-10 rounded-full border-2 transition-all', colorSecondary === c.id ? 'ring-2 ring-primary ring-offset-2 border-primary' : 'border-border hover:scale-110')} style={{ backgroundColor: c.color }} title={t(COLOR_I18N[c.id] || c.id)} />)}</div></div>
          <div className="space-y-2"><Label>{t('addgarment.form.pattern')}</Label><Select value={pattern} onValueChange={setPattern}><SelectTrigger><SelectValue placeholder={t('addgarment.form.select_pattern')} /></SelectTrigger><SelectContent>{patterns.map((p) => <SelectItem key={p} value={p.toLowerCase()}>{t(PATTERN_I18N[p.toLowerCase()] || p)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('addgarment.form.material')}</Label><Select value={material} onValueChange={setMaterial}><SelectTrigger><SelectValue placeholder={t('addgarment.form.select_material')} /></SelectTrigger><SelectContent>{materials.map((m) => <SelectItem key={m} value={m.toLowerCase()}>{t(MATERIAL_I18N[m.toLowerCase()] || m)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>{t('addgarment.form.fit')}</Label><Select value={fit} onValueChange={setFit}><SelectTrigger><SelectValue placeholder={t('addgarment.form.select_fit')} /></SelectTrigger><SelectContent>{fits.map((f) => <SelectItem key={f} value={f.toLowerCase()}>{t(FIT_I18N[f.toLowerCase()] || f)}</SelectItem>)}</SelectContent></Select></div>

          <div className="space-y-2"><Label>{t('addgarment.form.season')}</Label><div className="flex flex-wrap gap-2">{seasons.map((season) => <Badge key={season} variant={selectedSeasons.includes(season.toLowerCase()) ? 'default' : 'outline'} className="cursor-pointer px-4 py-2" onClick={() => toggleSeason(season.toLowerCase())}>{t(SEASON_I18N[season.toLowerCase()] || season)}</Badge>)}</div></div>
          <div className="space-y-3"><div className="flex items-center justify-between"><Label>{t('addgarment.form.formality')}</Label><span className="text-sm text-muted-foreground">{formality[0]} / 5</span></div><Slider value={formality} onValueChange={setFormality} max={5} min={1} step={1} /><div className="flex justify-between text-xs text-muted-foreground"><span>{t('addgarment.form.casual')}</span><span>{t('addgarment.form.formal')}</span></div></div>
          <div className="flex items-center justify-between p-4 bg-secondary"><Label>{t('addgarment.form.in_laundry')}</Label><Switch checked={inLaundry} onCheckedChange={setInLaundry} /></div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-3 max-w-lg mx-auto">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isLoading}>{t('common.cancel')}</Button>
        <Button className="flex-1" onClick={onSave} disabled={isLoading || !title || !category || !colorPrimary}>
          {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('addgarment.saving')}</> : t('addgarment.save')}
        </Button>
      </div>
    </div>
  );
}
