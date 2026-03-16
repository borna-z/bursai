import { useState, useMemo } from 'react';
import { hapticMedium, hapticHeavy, hapticSuccess } from '@/lib/haptics';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, WashingMachine, Check, Loader2, ExternalLink, Sparkles, Shield, DollarSign, Layers, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useGarment, useUpdateGarment, useDeleteGarment, useMarkGarmentWorn } from '@/hooks/useGarments';
import { useSimilarGarments } from '@/hooks/useSimilarGarments';
import { useAssessCondition, useCostPerWear } from '@/hooks/useAdvancedFeatures';
import { LazyImage } from '@/components/ui/lazy-image';
import { SectionHeader } from '@/components/ui/section-header';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import { cn } from '@/lib/utils';

/* ─── Enrichment data extracted from ai_raw ─── */
interface EnrichmentData {
  neckline?: string | null;
  sleeve_length?: string | null;
  garment_length?: string | null;
  closure?: string | null;
  fabric_weight?: string | null;
  silhouette?: string | null;
  visual_weight?: string | null;
  texture_intensity?: string | null;
  shoulder_structure?: string | null;
  drape?: string | null;
  rise?: string | null;
  leg_shape?: string | null;
  hem_detail?: string | null;
  style_archetype?: string | null;
  style_tags?: string[];
  occasion_tags?: string[];
  layering_role?: string | null;
  care_instructions?: string[];
  versatility_score?: number | null;
  color_harmony_notes?: string | null;
  stylist_note?: string | null;
  confidence?: number | null;
}

function extractEnrichment(aiRaw: unknown): EnrichmentData | null {
  if (!aiRaw || typeof aiRaw !== 'object') return null;
  const raw = aiRaw as Record<string, unknown>;
  const enrichment = (raw.enrichment as Record<string, unknown>) || null;
  if (!enrichment) return null;
  const str = (key: string) => typeof enrichment[key] === 'string' ? enrichment[key] as string : null;
  const num = (key: string) => typeof enrichment[key] === 'number' ? enrichment[key] as number : null;
  const arr = (key: string) => Array.isArray(enrichment[key]) ? enrichment[key] as string[] : undefined;
  return {
    neckline: str('neckline'),
    sleeve_length: str('sleeve_length'),
    garment_length: str('garment_length'),
    closure: str('closure'),
    fabric_weight: str('fabric_weight'),
    silhouette: str('silhouette'),
    visual_weight: str('visual_weight'),
    texture_intensity: str('texture_intensity'),
    shoulder_structure: str('shoulder_structure'),
    drape: str('drape'),
    rise: str('rise'),
    leg_shape: str('leg_shape'),
    hem_detail: str('hem_detail'),
    style_archetype: str('style_archetype'),
    style_tags: arr('style_tags'),
    occasion_tags: arr('occasion_tags'),
    layering_role: str('layering_role'),
    care_instructions: arr('care_instructions'),
    versatility_score: num('versatility_score'),
    color_harmony_notes: str('color_harmony_notes'),
    stylist_note: str('stylist_note'),
    confidence: num('confidence'),
  };
}

/* ─── Detail chip row ─── */
function DetailChips({ items, variant = 'secondary' }: { items: string[]; variant?: 'secondary' | 'outline' }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant} className="text-[11px] px-2.5 py-1 capitalize font-normal">
          {item}
        </Badge>
      ))}
    </div>
  );
}

/* ─── Specs row ─── */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground capitalize">{value}</span>
    </div>
  );
}

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const { data: garment, isLoading } = useGarment(id);
  const { data: similarGarments } = useSimilarGarments(garment);
  const updateGarment = useUpdateGarment();
  const deleteGarment = useDeleteGarment();
  const markWorn = useMarkGarmentWorn();
  const assessCondition = useAssessCondition();
  const costPerWear = useCostPerWear(
    garment?.purchase_price ?? null,
    garment?.wear_count ?? null
  );
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const enrichment = useMemo(() => garment ? extractEnrichment(garment.ai_raw) : null, [garment]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <Skeleton className="aspect-[3/4] w-full" />
        <div className="px-6 pt-8 space-y-6">
          <div>
            <Skeleton className="h-7 w-2/3 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-8">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-12 w-20" />
          </div>
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

  const handleToggleLaundry = async () => {
    try {
      hapticMedium();
      await updateGarment.mutateAsync({ id: garment.id, updates: { in_laundry: !garment.in_laundry } });
      toast.success(garment.in_laundry ? t('garment.available') : t('garment.in_laundry'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleMarkWorn = async () => {
    try {
      hapticSuccess();
      await markWorn.mutateAsync(garment.id);
      toast.success(t('garment.marked'));
    } catch { toast.error(t('common.something_wrong')); }
  };

  const handleDelete = async () => {
    try {
      hapticHeavy();
      await deleteGarment.mutateAsync(garment.id);
      toast.success(t('garment.deleted'));
      navigate('/wardrobe');
    } catch { toast.error(t('common.something_wrong')); }
  };

  // Build metadata string
  const metaParts: string[] = [];
  if (garment.color_primary) metaParts.push(t(`color.${garment.color_primary}`));
  if (garment.color_secondary) metaParts.push(t(`color.${garment.color_secondary}`));
  if (garment.material) metaParts.push(t(`garment.material.${garment.material}`));
  if (garment.pattern && garment.pattern !== 'solid') metaParts.push(t(`garment.pattern.${garment.pattern}`));
  if (garment.fit) metaParts.push(t(`garment.fit.${garment.fit}`));

  const seasonParts: string[] = [];
  garment.season_tags?.forEach((season) => {
    const key = season === 'vår' ? 'spring' : season === 'sommar' ? 'summer' : season === 'höst' ? 'autumn' : season === 'vinter' ? 'winter' : season;
    seasonParts.push(t(`garment.season.${key}`));
  });
  if (garment.formality) seasonParts.push(`${t('garment.formality')} ${garment.formality}/5`);

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Hero image with floating controls */}
      <div className="relative overflow-hidden">
        <LazyImage imagePath={garment.image_path} alt={garment.title} aspectRatio="3/4" className="w-full !rounded-none" />
        
        {/* Floating back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 backdrop-blur-xl bg-background/40 h-10 w-10 shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Floating action buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/wardrobe/${garment.id}/edit`)}
            className="backdrop-blur-xl bg-background/40 h-10 w-10 shadow-lg"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="backdrop-blur-xl bg-background/40 h-10 w-10 shadow-lg">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('garment.delete_confirm')}</AlertDialogTitle>
                <AlertDialogDescription>"{garment.title}" {t('garment.delete_desc')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-8 space-y-8 max-w-lg mx-auto">
        {/* Title + category */}
        <div>
          <h1 className="text-2xl font-semibold">{garment.title}</h1>
          <p className="text-[13px] text-muted-foreground/60 uppercase tracking-wide mt-1">
            {t(`garment.category.${garment.category}`) || garment.subcategory || garment.category}
          </p>
        </div>

        {/* Metadata — dot-separated */}
        {metaParts.length > 0 && (
          <p className="text-[13px] text-muted-foreground capitalize">
            {metaParts.join(' · ')}
          </p>
        )}
        {seasonParts.length > 0 && (
          <p className="text-[13px] text-muted-foreground/60 capitalize -mt-4">
            {seasonParts.join(' · ')}
          </p>
        )}

        {/* Stylist note — editorial highlight */}
        {enrichment?.stylist_note && (
          <div className="border-l-2 border-primary/30 pl-4 py-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">{t('garment.stylist_note') || 'Stylist note'}</p>
            <p className="text-[13px] text-foreground/80 italic leading-relaxed">{enrichment.stylist_note}</p>
          </div>
        )}

        {/* Style archetype + tags */}
        {(enrichment?.style_archetype || (enrichment?.style_tags && enrichment.style_tags.length > 0)) && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{t('garment.style') || 'Style'}</p>
            <div className="flex flex-wrap gap-1.5">
              {enrichment?.style_archetype && (
                <Badge variant="default" className="text-[11px] px-2.5 py-1 capitalize font-medium">
                  {enrichment.style_archetype}
                </Badge>
              )}
              {enrichment?.style_tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px] px-2.5 py-1 capitalize font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Enrichment: Occasion tags */}
        {enrichment?.occasion_tags && enrichment.occasion_tags.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{t('garment.occasions') || 'Occasions'}</p>
            <DetailChips items={enrichment.occasion_tags} variant="outline" />
          </div>
        )}

        {/* Garment intelligence — silhouette, texture, structure */}
        {enrichment && (enrichment.silhouette || enrichment.visual_weight || enrichment.texture_intensity || enrichment.drape) && (
          <div className="space-y-1 border border-border/10 px-4 py-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 pt-2 pb-1">{t('garment.intelligence') || 'Garment intelligence'}</p>
            {enrichment.silhouette && <SpecRow label={t('garment.silhouette') || 'Silhouette'} value={enrichment.silhouette} />}
            {enrichment.visual_weight && <SpecRow label={t('garment.visual_weight') || 'Visual weight'} value={enrichment.visual_weight} />}
            {enrichment.texture_intensity && <SpecRow label={t('garment.texture') || 'Texture'} value={enrichment.texture_intensity} />}
            {enrichment.drape && <SpecRow label={t('garment.drape') || 'Drape'} value={enrichment.drape} />}
            {enrichment.shoulder_structure && <SpecRow label={t('garment.shoulder') || 'Shoulder'} value={enrichment.shoulder_structure} />}
            {enrichment.hem_detail && <SpecRow label={t('garment.hem') || 'Hem'} value={enrichment.hem_detail} />}
          </div>
        )}

        {/* Construction specs — bottoms-specific + general */}
        {enrichment && (enrichment.neckline || enrichment.sleeve_length || enrichment.garment_length || enrichment.closure || enrichment.fabric_weight || enrichment.layering_role || enrichment.rise || enrichment.leg_shape) && (
          <div className="space-y-1 border border-border/10 px-4 py-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 pt-2 pb-1">{t('garment.construction') || 'Construction'}</p>
            {enrichment.neckline && <SpecRow label={t('garment.neckline') || 'Neckline'} value={enrichment.neckline} />}
            {enrichment.sleeve_length && <SpecRow label={t('garment.sleeve') || 'Sleeve'} value={enrichment.sleeve_length} />}
            {enrichment.garment_length && <SpecRow label={t('garment.length') || 'Length'} value={enrichment.garment_length} />}
            {enrichment.closure && <SpecRow label={t('garment.closure') || 'Closure'} value={enrichment.closure} />}
            {enrichment.fabric_weight && <SpecRow label={t('garment.weight') || 'Weight'} value={enrichment.fabric_weight} />}
            {enrichment.layering_role && <SpecRow label={t('garment.layering') || 'Layering'} value={enrichment.layering_role} />}
            {enrichment.rise && <SpecRow label={t('garment.rise') || 'Rise'} value={enrichment.rise} />}
            {enrichment.leg_shape && <SpecRow label={t('garment.leg_shape') || 'Leg shape'} value={enrichment.leg_shape} />}
          </div>
        )}

        {/* Enrichment: Versatility + color harmony */}
        {enrichment?.versatility_score != null && (
          <div className="flex items-center gap-3 py-2">
            <Layers className="w-4 h-4 text-muted-foreground/50" />
            <div>
              <p className="text-xs text-foreground">{t('garment.versatility') || 'Versatility'}: {enrichment.versatility_score}/10</p>
              {enrichment.color_harmony_notes && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{enrichment.color_harmony_notes}</p>
              )}
            </div>
          </div>
        )}

        {/* Confidence indicator */}
        {enrichment?.confidence != null && enrichment.confidence < 0.7 && (
          <p className="text-[11px] text-muted-foreground/40 italic">
            {t('garment.low_confidence') || 'Some details may need manual review'} · {Math.round(enrichment.confidence * 100)}%
          </p>
        )}

        {/* Enrichment: Care instructions */}
        {enrichment?.care_instructions && enrichment.care_instructions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{t('garment.care') || 'Care'}</p>
            <DetailChips items={enrichment.care_instructions} variant="outline" />
          </div>
        )}

        <div className="flex">
          <div className="flex-1 text-center">
            <p className="text-2xl font-semibold tabular-nums">{garment.wear_count || 0}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">{t('garment.worn_count')}</p>
          </div>
          <div className="w-px bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-semibold tabular-nums">
              {garment.last_worn_at
                ? new Date(garment.last_worn_at).toLocaleDateString(getBCP47(locale), { day: 'numeric', month: 'short' })
                : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-1">{t('garment.last_worn')}</p>
          </div>
        </div>

        {/* Source URL */}
        {garment.source_url && (
          <a
            href={garment.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t('garment.imported')}</span>
          </a>
        )}

        {/* Laundry toggle */}
        <div className="flex items-center justify-between py-4 border-t border-border/10">
          <div className="flex items-center gap-3">
            <WashingMachine className="w-5 h-5 text-muted-foreground/50" />
            <span className="text-sm">{t('garment.in_laundry')}</span>
          </div>
          <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
        </div>

        {/* Step 18: Condition Assessment */}
        <div className="flex items-center justify-between py-4 border-t border-border/10">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-muted-foreground/50" />
            <div>
              <span className="text-sm">{t('insights.condition')}</span>
              {garment.condition_score && (
                <p className="text-xs text-muted-foreground">
                  {Number(garment.condition_score).toFixed(1)}/10 — {garment.condition_notes}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
              className="text-xs"
            onClick={async () => {
              try {
                await assessCondition.mutateAsync(garment.id);
                toast.success(t('insights.condition'));
              } catch {
                toast.error(t('insights.condition_error'));
              }
            }}
            disabled={assessCondition.isPending}
          >
            {assessCondition.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              t('insights.condition_check')
            )}
          </Button>
        </div>

        {/* Step 22: Cost-per-wear */}
        <div className="flex items-center justify-between py-4 border-t border-border/10">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-muted-foreground/50" />
            <div>
              <span className="text-sm">{t('insights.cost_per_wear')}</span>
              {costPerWear !== null && (
                <p className="text-xs text-primary font-medium">
                  {costPerWear.toFixed(0)} {garment.purchase_currency || 'SEK'}/{t('garment.worn_count')}
                </p>
              )}
            </div>
          </div>
          {editingPrice ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0"
                className="w-20 h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={async () => {
                  const price = parseFloat(priceInput);
                  if (isNaN(price) || price < 0) return;
                  try {
                    await updateGarment.mutateAsync({ id: garment.id, updates: { purchase_price: price } });
                    setEditingPrice(false);
                  } catch { toast.error(t('common.something_wrong')); }
                }}
              >
                <Check className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setPriceInput(String(garment.purchase_price || ''));
                setEditingPrice(true);
              }}
            >
              {garment.purchase_price ? `${Number(garment.purchase_price).toFixed(0)} SEK` : t('insights.purchase_price')}
            </Button>
          )}
        </div>
        {similarGarments && similarGarments.length > 0 && (
          <div className="space-y-3">
            <SectionHeader title={t('garment.similar_items') || 'Similar items'} />
            <div className="flex gap-2.5 overflow-x-auto -mx-6 px-6 pb-1 scrollbar-hide">
              {similarGarments.map((g) => (
                <button
                  key={g.id}
                  onClick={() => navigate(`/wardrobe/${g.id}`)}
                  className="flex-shrink-0 w-[88px] space-y-1.5 active:scale-[0.97] transition-transform"
                >
                  <LazyImage
                    imagePath={g.image_path}
                    alt={g.title}
                    aspectRatio="3/4"
                    className=""
                  />
                  <p className="text-[11px] text-muted-foreground truncate">{g.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI analyzed */}
        {garment.ai_analyzed_at && (
          <p className="text-[11px] text-muted-foreground/40 text-center">
            {t('garment.analyzed_at')} {new Date(garment.ai_analyzed_at).toLocaleDateString(getBCP47(locale))}
          </p>
        )}
      </div>

      {/* ── Sticky bottom action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background/60 backdrop-blur-2xl border-t border-border/15 safe-bottom">
        <div className="flex items-center gap-3 px-5 py-4 max-w-lg mx-auto">
          <Button className="flex-1 h-12" onClick={() => navigate('/', { state: { prefillGarmentId: garment.id } })}>
            <Sparkles className="w-4 h-4 mr-2" />
            {t('garment.use_in_outfit')}
          </Button>
          <Button variant="outline" className="h-12 px-4 shrink-0" onClick={handleMarkWorn} disabled={markWorn.isPending}>
            {markWorn.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
