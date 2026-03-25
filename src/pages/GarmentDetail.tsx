import { useEffect, useState, useMemo } from 'react';
import { hapticMedium, hapticHeavy, hapticSuccess, hapticLight } from '@/lib/haptics';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit, Trash2, WashingMachine, Check, Loader2, ExternalLink,
  Sparkles, Shield, Layers,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useGarment, useUpdateGarment, useDeleteGarment, useMarkGarmentWorn } from '@/hooks/useGarments';
import { useSimilarGarments } from '@/hooks/useSimilarGarments';
import { useAssessCondition, useCostPerWear } from '@/hooks/useAdvancedFeatures';
import { useGarmentOutfitHistory } from '@/hooks/useGarmentOutfitHistory';
import { LazyImage, LazyImageSimple } from '@/components/ui/lazy-image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getBCP47 } from '@/lib/dateLocale';
import { humanize, categoryLabel, colorLabel, materialLabel, patternLabel, fitLabel, seasonLabel, occasionLabel, confidenceLabel } from '@/lib/humanize';
import { EASE_CURVE } from '@/lib/motion';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { getPreferredGarmentImagePath, getPreferredGarmentImageSource, getGarmentProcessingMessage } from '@/lib/garmentImage';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

type EnrichmentStatus = 'none' | 'pending' | 'in_progress' | 'complete' | 'failed';

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

/* ─── Specs row ─── */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0',
    }}>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.45)' }}>{label}</span>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#1C1917', textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();

  const [isEnrichmentPending, setIsEnrichmentPending] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'outfits' | 'similar'>('info');

  const { data: garment, isLoading } = useGarment(id, {
    refetchInterval: isEnrichmentPending ? 5000 : false,
  });

  const enrichmentStatus: EnrichmentStatus = (garment?.enrichment_status as EnrichmentStatus) || 'none';

  useEffect(() => {
    const shouldPoll =
      enrichmentStatus === 'pending' ||
      enrichmentStatus === 'in_progress' ||
      garment?.image_processing_status === 'pending' ||
      garment?.image_processing_status === 'processing' ||
      garment?.render_status === 'pending' ||
      garment?.render_status === 'rendering';
    setIsEnrichmentPending(shouldPoll);
  }, [enrichmentStatus, garment?.image_processing_status, garment?.render_status]);

  const { data: similarGarments } = useSimilarGarments(garment);
  const { data: outfitHistory } = useGarmentOutfitHistory(id);
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
  const [isRetrying, setIsRetrying] = useState(false);
  const enrichment = useMemo(() => garment ? extractEnrichment(garment.ai_raw) : null, [garment]);

  const usageInsights = useMemo(() => {
    if (!garment) return null;
    const wearCount = garment.wear_count || 0;
    const lastWorn = garment.last_worn_at ? new Date(garment.last_worn_at) : null;
    const created = garment.created_at ? new Date(garment.created_at) : new Date();
    const daysSinceLastWorn = lastWorn ? Math.floor((Date.now() - lastWorn.getTime()) / 86400000) : null;
    const daysOwned = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000));
    const wearFrequency = daysOwned > 0 ? (wearCount / daysOwned * 30).toFixed(1) : '0';

    let status: 'active' | 'neglected' | 'new' = 'active';
    if (wearCount === 0) status = 'new';
    else if (daysSinceLastWorn != null && daysSinceLastWorn > 60) status = 'neglected';

    return { wearCount, daysSinceLastWorn, wearFrequency, daysOwned, status };
  }, [garment]);

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

  const handleRetryEnrichment = async () => {
    if (!garment || isRetrying) return;
    setIsRetrying(true);
    try {
      await supabase.from('garments').update({ enrichment_status: 'in_progress' } as Record<string, unknown>).eq('id', garment.id);
      const { data, error } = await invokeEdgeFunction<{ enrichment?: Record<string, unknown>; error?: string }>('analyze_garment', {
        body: { storagePath: garment.image_path, mode: 'enrich' },
      });
      if (error || !data?.enrichment) {
        await supabase.from('garments').update({ enrichment_status: 'failed' } as Record<string, unknown>).eq('id', garment.id);
        queryClient.invalidateQueries({ queryKey: ['garment', garment.id] });
        toast.error('Deep analysis failed — try again later');
        return;
      }
      const currentRaw = (garment.ai_raw as Record<string, unknown>) || {};
      const mergedRaw = { ...currentRaw, enrichment: data.enrichment };
      const updates: Record<string, unknown> = { ai_raw: mergedRaw as Json, enrichment_status: 'complete' };
      if (data.enrichment.refined_title && typeof data.enrichment.refined_title === 'string') {
        updates.title = (data.enrichment.refined_title as string).substring(0, 50);
      }
      await supabase.from('garments').update(updates).eq('id', garment.id);
      queryClient.invalidateQueries({ queryKey: ['garment', garment.id] });
      toast.success('Deep analysis complete');
    } catch {
      await supabase.from('garments').update({ enrichment_status: 'failed' } as Record<string, unknown>).eq('id', garment.id);
      queryClient.invalidateQueries({ queryKey: ['garment', garment.id] });
      toast.error('Something went wrong');
    } finally {
      setIsRetrying(false);
    }
  };

  const seasonParts: string[] = [];
  garment.season_tags?.forEach((season) => {
    seasonParts.push(seasonLabel(t, season));
  });

  const displayImagePath = getPreferredGarmentImagePath(garment);
  const displayImageSource = getPreferredGarmentImageSource(garment);
  const processingMessage = getGarmentProcessingMessage(garment.image_processing_status, garment.render_status, displayImageSource);

  const tabs = [
    { key: 'info' as const, label: 'Info' },
    { key: 'outfits' as const, label: 'Outfits' },
    { key: 'similar' as const, label: 'Similar' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8', paddingBottom: 80 }}>

      {/* ── Zone 1: Hero image (55vh) ── */}
      <div style={{ position: 'relative', height: '55vh', background: '#EDE8DF', overflow: 'hidden' }}>
        <LazyImage imagePath={displayImagePath} alt={garment.title} aspectRatio="auto" className="w-full h-full !rounded-none object-cover" />
        <RenderPendingOverlay renderStatus={garment.render_status} variant="overlay" />

        {/* Back arrow — top-left */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute', top: 16, left: 16, zIndex: 10,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,240,232,0.85)', border: 'none', cursor: 'pointer',
          }}
        >
          <ArrowLeft style={{ width: 18, height: 18, color: '#1C1917' }} />
        </button>

        {/* Edit + Delete — top-right */}
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate(`/wardrobe/${garment.id}/edit`)}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(245,240,232,0.85)', border: 'none', cursor: 'pointer',
            }}
          >
            <Edit style={{ width: 16, height: 16, color: '#1C1917' }} />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                style={{
                  width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(245,240,232,0.85)', border: 'none', cursor: 'pointer',
                }}
              >
                <Trash2 style={{ width: 16, height: 16, color: '#dc2626' }} />
              </button>
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

        {/* Wear count badge — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 12, left: 16, zIndex: 10,
          background: '#1C1917', padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 500, color: '#F5F0E8' }}>
            {garment.wear_count || 0}× worn
          </span>
        </div>

        {/* Laundry badge */}
        {garment.in_laundry && (
          <div style={{
            position: 'absolute', bottom: 12, right: 16, zIndex: 10,
            background: '#1C1917', padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <WashingMachine style={{ width: 12, height: 12, color: 'rgba(245,240,232,0.6)' }} />
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 500, color: '#F5F0E8' }}>
              In laundry
            </span>
          </div>
        )}

        {/* Processing badge */}
        {processingMessage && (
          <div style={{ position: 'absolute', bottom: 12, left: garment.in_laundry ? 16 : 'auto', right: garment.in_laundry ? 'auto' : 16, zIndex: 10 }}>
            <GarmentProcessingBadge
              status={garment.image_processing_status}
              renderStatus={garment.render_status}
              className="bg-background/85"
              displaySource={displayImageSource}
            />
          </div>
        )}
      </div>

      {/* ── Zone 2: Pull-up info card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_CURVE }}
        style={{
          background: '#F5F0E8', padding: '12px 16px',
          marginTop: -8,
          position: 'relative', zIndex: 5,
        }}
      >
        {/* Title */}
        <h1 style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500,
          color: '#1C1917', margin: 0,
        }}>
          {garment.title}
        </h1>

        {/* Category + color chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{
            background: '#EDE8DF', padding: '3px 8px',
            fontFamily: 'DM Sans, sans-serif', fontSize: 8, fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.5)',
          }}>
            {categoryLabel(t, garment.category)}{garment.subcategory ? ` · ${humanize(garment.subcategory)}` : ''}
          </span>
          {garment.color_primary && (
            <span style={{
              background: '#EDE8DF', padding: '3px 8px',
              fontFamily: 'DM Sans, sans-serif', fontSize: 8, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.5)',
            }}>
              {colorLabel(t, garment.color_primary)}
            </span>
          )}
          {garment.material && (
            <span style={{
              background: '#EDE8DF', padding: '3px 8px',
              fontFamily: 'DM Sans, sans-serif', fontSize: 8, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.5)',
            }}>
              {materialLabel(t, garment.material)}
            </span>
          )}
        </div>

        {/* Formality indicator */}
        {garment.formality && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Formality
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  width: 16, height: 3,
                  background: i <= garment.formality! ? '#1C1917' : 'rgba(28,25,23,0.1)',
                }} />
              ))}
            </div>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.38)' }}>
              {garment.formality}/5
            </span>
          </div>
        )}
      </motion.div>

      {/* ── 3-tab row ── */}
      <div style={{
        display: 'flex', background: '#EDE8DF',
        marginTop: 0,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { hapticLight(); setActiveTab(tab.key); }}
            style={{
              flex: 1, padding: '10px 0',
              fontFamily: 'DM Sans, sans-serif', fontSize: 9, fontWeight: activeTab === tab.key ? 600 : 400,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: activeTab === tab.key ? '#1C1917' : 'rgba(28,25,23,0.4)',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.key ? '1.5px solid #1C1917' : '1.5px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: '16px 20px', maxWidth: 512, margin: '0 auto' }}>

        {/* ── INFO TAB ── */}
        {activeTab === 'info' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Stylist note */}
            {enrichment?.stylist_note && (
              <p style={{
                fontFamily: '"Playfair Display", serif', fontStyle: 'italic',
                fontSize: 11, color: 'rgba(28,25,23,0.7)', lineHeight: 1.6,
                margin: 0,
              }}>
                {enrichment.stylist_note}
              </p>
            )}

            {/* Cost per wear — large number */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontFamily: '"Playfair Display", serif', fontSize: 20, color: '#1C1917',
              }}>
                {costPerWear !== null ? `${costPerWear.toFixed(0)}` : '—'}
              </span>
              <span style={{
                fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {garment.purchase_currency || 'SEK'} / wear
              </span>
              {!garment.purchase_price && (
                <button
                  onClick={() => { setPriceInput(''); setEditingPrice(true); }}
                  style={{
                    fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.4)',
                    textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  Add price
                </button>
              )}
            </div>

            {/* Price editing inline */}
            {editingPrice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="0"
                  className="w-24 h-8 text-xs"
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
            )}

            {/* Material / Fit / Season rows */}
            <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)' }}>
              {garment.material && <SpecRow label="Material" value={materialLabel(t, garment.material)} />}
              {garment.fit && <SpecRow label="Fit" value={fitLabel(t, garment.fit)} />}
              {garment.pattern && garment.pattern !== 'solid' && <SpecRow label="Pattern" value={patternLabel(t, garment.pattern)} />}
              {seasonParts.length > 0 && <SpecRow label="Season" value={seasonParts.join(', ')} />}
              {garment.color_secondary && <SpecRow label="Secondary color" value={colorLabel(t, garment.color_secondary)} />}
            </div>

            {/* Enrichment pending */}
            {isEnrichmentPending && !enrichment && (
              <div style={{ padding: 16, background: '#EDE8DF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Sparkles className="w-4 h-4 text-foreground/60 animate-pulse" />
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(28,25,23,0.7)', fontWeight: 500, margin: 0 }}>Deep analysis in progress</p>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}

            {/* Enrichment failed */}
            {enrichmentStatus === 'failed' && !enrichment && (
              <div style={{ padding: 16, background: '#EDE8DF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(28,25,23,0.7)', margin: 0 }}>Analysis incomplete</p>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={handleRetryEnrichment} disabled={isRetrying}>
                  {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Retry
                </Button>
              </div>
            )}

            {/* Garment intelligence — enrichment details */}
            {enrichment && (enrichment.silhouette || enrichment.visual_weight || enrichment.texture_intensity || enrichment.drape) && (
              <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)', padding: '10px 0 4px' }}>
                  Garment intelligence
                </p>
                {enrichment.silhouette && <SpecRow label="Silhouette" value={enrichment.silhouette} />}
                {enrichment.visual_weight && <SpecRow label="Visual weight" value={enrichment.visual_weight} />}
                {enrichment.texture_intensity && <SpecRow label="Texture" value={enrichment.texture_intensity} />}
                {enrichment.drape && <SpecRow label="Drape" value={enrichment.drape} />}
                {enrichment.shoulder_structure && <SpecRow label="Shoulder" value={enrichment.shoulder_structure} />}
                {enrichment.hem_detail && <SpecRow label="Hem" value={enrichment.hem_detail} />}
              </div>
            )}

            {/* Construction specs */}
            {enrichment && (enrichment.neckline || enrichment.sleeve_length || enrichment.garment_length || enrichment.closure || enrichment.fabric_weight || enrichment.layering_role || enrichment.rise || enrichment.leg_shape) && (
              <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)' }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)', padding: '10px 0 4px' }}>
                  Construction
                </p>
                {enrichment.neckline && <SpecRow label="Neckline" value={enrichment.neckline} />}
                {enrichment.sleeve_length && <SpecRow label="Sleeve" value={enrichment.sleeve_length} />}
                {enrichment.garment_length && <SpecRow label="Length" value={enrichment.garment_length} />}
                {enrichment.closure && <SpecRow label="Closure" value={enrichment.closure} />}
                {enrichment.fabric_weight && <SpecRow label="Weight" value={enrichment.fabric_weight} />}
                {enrichment.layering_role && <SpecRow label="Layering" value={enrichment.layering_role} />}
                {enrichment.rise && <SpecRow label="Rise" value={enrichment.rise} />}
                {enrichment.leg_shape && <SpecRow label="Leg shape" value={enrichment.leg_shape} />}
              </div>
            )}

            {/* Style archetype + tags */}
            {(enrichment?.style_archetype || (enrichment?.style_tags && enrichment.style_tags.length > 0)) && (
              <div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)', marginBottom: 6 }}>
                  Style
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {enrichment?.style_archetype && (
                    <span style={{ background: '#1C1917', color: '#F5F0E8', padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'capitalize' }}>
                      {enrichment.style_archetype}
                    </span>
                  )}
                  {enrichment?.style_tags?.map((tag) => (
                    <span key={tag} style={{ background: '#EDE8DF', color: '#1C1917', padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'capitalize' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Occasion tags */}
            {enrichment?.occasion_tags && enrichment.occasion_tags.length > 0 && (
              <div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)', marginBottom: 6 }}>
                  Occasions
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {enrichment.occasion_tags.map((tag) => (
                    <span key={tag} style={{ background: '#EDE8DF', color: 'rgba(28,25,23,0.7)', padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'capitalize' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Versatility */}
            {enrichment?.versatility_score != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers style={{ width: 14, height: 14, color: 'rgba(28,25,23,0.4)' }} />
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#1C1917' }}>
                  Versatility: {enrichment.versatility_score}/10
                </span>
                {enrichment.color_harmony_notes && (
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.5)' }}>
                    — {enrichment.color_harmony_notes}
                  </span>
                )}
              </div>
            )}

            {/* Confidence */}
            {enrichment?.confidence != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: enrichment.confidence >= 0.85 ? '#10b981' : enrichment.confidence >= 0.6 ? '#f59e0b' : 'rgba(28,25,23,0.3)',
                }} />
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.5)' }}>
                  {confidenceLabel(enrichment.confidence).label} · {Math.round(enrichment.confidence * 100)}%
                </span>
              </div>
            )}

            {/* Care instructions */}
            {enrichment?.care_instructions && enrichment.care_instructions.length > 0 && (
              <div>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)', marginBottom: 6 }}>
                  Care
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {enrichment.care_instructions.map((item) => (
                    <span key={item} style={{ background: '#EDE8DF', color: 'rgba(28,25,23,0.7)', padding: '3px 8px', fontFamily: 'DM Sans, sans-serif', fontSize: 10, textTransform: 'capitalize' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions: Laundry, Condition, Price */}
            <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)', paddingTop: 12 }}>
              {/* Laundry toggle */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <WashingMachine className="w-4 h-4" style={{ color: 'rgba(28,25,23,0.4)' }} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#1C1917' }}>{t('garment.in_laundry')}</span>
                </div>
                <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
              </div>

              {/* Condition */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4" style={{ color: 'rgba(28,25,23,0.4)' }} />
                  <div>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: '#1C1917' }}>{t('insights.condition')}</span>
                    {garment.condition_score && (
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.5)', margin: 0 }}>
                        {Number(garment.condition_score).toFixed(1)}/10 — {garment.condition_notes}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={async () => {
                  try { await assessCondition.mutateAsync(garment.id); toast.success(t('insights.condition')); }
                  catch { toast.error(t('insights.condition_error')); }
                }} disabled={assessCondition.isPending}>
                  {assessCondition.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t('insights.condition_check')}
                </Button>
              </div>
            </div>

            {/* Source URL */}
            {garment.source_url && (
              <a
                href={garment.source_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.45)', textDecoration: 'none' }}
              >
                <ExternalLink style={{ width: 12, height: 12 }} />
                <span>{t('garment.imported')}</span>
              </a>
            )}

            {/* Analyzed date */}
            {garment.ai_analyzed_at && (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.3)', textAlign: 'center', margin: 0 }}>
                Analyzed {new Date(garment.ai_analyzed_at).toLocaleDateString(getBCP47(locale))}
              </p>
            )}
          </motion.div>
        )}

        {/* ── OUTFITS TAB ── */}
        {activeTab === 'outfits' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {outfitHistory && outfitHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(28,25,23,0.38)' }}>
                  Worn in {outfitHistory.length} outfit{outfitHistory.length !== 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
                  {outfitHistory.slice(0, 8).map((outfit) => (
                    <button
                      key={outfit.id}
                      onClick={() => { hapticLight(); navigate(`/outfits/${outfit.id}`); }}
                      style={{
                        flexShrink: 0, width: 88, display: 'flex', flexDirection: 'column', gap: 6,
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ aspectRatio: '1/1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, overflow: 'hidden', background: '#EDE8DF' }}>
                        {outfit.outfit_items.slice(0, 4).map((item) => (
                          <div key={item.id} style={{ overflow: 'hidden' }}>
                            <LazyImageSimple
                              imagePath={item.garment ? getPreferredGarmentImagePath(item.garment) : undefined}
                              alt={item.garment?.title || item.slot}
                              className="w-full h-full"
                            />
                          </div>
                        ))}
                      </div>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.5)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {occasionLabel(t, outfit.occasion)}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Usage stats */}
                {usageInsights && (
                  <div style={{ borderTop: '1px solid rgba(28,25,23,0.06)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <div>
                        <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>{usageInsights.wearCount}</p>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Total wears</p>
                      </div>
                      <div>
                        <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>{usageInsights.wearFrequency}×</p>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Per month</p>
                      </div>
                      {usageInsights.daysSinceLastWorn != null && (
                        <div>
                          <p style={{ fontFamily: '"Playfair Display", serif', fontSize: 18, color: '#1C1917', margin: 0 }}>
                            {usageInsights.daysSinceLastWorn === 0 ? 'Today' : `${usageInsights.daysSinceLastWorn}d`}
                          </p>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: 'rgba(28,25,23,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Last worn</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 14, color: 'rgba(28,25,23,0.5)', margin: 0 }}>
                  No outfits yet
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.35)', marginTop: 4 }}>
                  Style this piece to create your first look.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── SIMILAR TAB ── */}
        {activeTab === 'similar' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {similarGarments && similarGarments.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scrollbar-hide">
                {similarGarments.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => navigate(`/wardrobe/${g.id}`)}
                    style={{
                      flexShrink: 0, width: 100, display: 'flex', flexDirection: 'column', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ aspectRatio: '3/4', overflow: 'hidden', background: '#EDE8DF' }}>
                      <LazyImageSimple
                        imagePath={getPreferredGarmentImagePath(g)}
                        alt={g.title}
                        className="w-full h-full"
                      />
                    </div>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(28,25,23,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                      {g.title}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 14, color: 'rgba(28,25,23,0.5)', margin: 0 }}>
                  No similar items found
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.35)', marginTop: 4 }}>
                  Add more garments to discover matches.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Fixed CTA: "Style around this" ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: '#F5F0E8', borderTop: '1px solid rgba(28,25,23,0.06)',
        padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 512, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/ai', { state: { selectedGarmentId: garment.id } })}
            style={{
              width: '100%', height: 48, background: '#1C1917', color: '#F5F0E8',
              border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Sparkles style={{ width: 14, height: 14 }} />
            Style around this
          </button>
        </div>
      </div>
    </div>
  );
}
