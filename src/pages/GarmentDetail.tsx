import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Check,
  Edit,
  ExternalLink,
  Loader2,
  Shield,
  Sparkles,
  Trash2,
  WashingMachine,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/layout/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { GarmentEnrichmentPanel, SpecRow, extractEnrichment, type EnrichmentStatus } from '@/components/garment/GarmentEnrichmentPanel';
import { GarmentOutfitHistory } from '@/components/garment/GarmentOutfitHistory';
import { GarmentSimilarItems } from '@/components/garment/GarmentSimilarItems';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LazyImage } from '@/components/ui/lazy-image';
import { PageIntro } from '@/components/ui/page-intro';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAssessCondition, useCostPerWear } from '@/hooks/useAdvancedFeatures';
import { useGarmentOutfitHistory } from '@/hooks/useGarmentOutfitHistory';
import { useDeleteGarment, useGarment, useMarkGarmentWorn, useUpdateGarment } from '@/hooks/useGarments';
import { useSimilarGarments } from '@/hooks/useSimilarGarments';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { getBCP47 } from '@/lib/dateLocale';
import { invokeEdgeFunction } from '@/lib/edgeFunctionClient';
import { getGarmentProcessingMessage, getPreferredGarmentImagePath, getPreferredGarmentImageSource } from '@/lib/garmentImage';
import { hapticHeavy, hapticLight, hapticMedium, hapticSuccess } from '@/lib/haptics';
import { categoryLabel, colorLabel, fitLabel, humanize, materialLabel, patternLabel, seasonLabel } from '@/lib/humanize';
import { EASE_CURVE } from '@/lib/motion';
import { buildStyleAroundState, buildStyleFlowSearch } from '@/lib/styleFlowState';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();

  const [isEnrichmentPending, setIsEnrichmentPending] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'outfits' | 'similar'>('info');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

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
  const costPerWear = useCostPerWear(garment?.purchase_price ?? null, garment?.wear_count ?? null);
  const enrichment = useMemo(() => (garment ? extractEnrichment(garment.ai_raw) : null), [garment]);

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

  const seasonParts = useMemo(() => {
    const values: string[] = [];
    garment?.season_tags?.forEach((season) => values.push(seasonLabel(t, season)));
    return values;
  }, [garment?.season_tags, t]);

  const displayImagePath = garment ? getPreferredGarmentImagePath(garment) : undefined;
  const displayImageSource = garment ? getPreferredGarmentImageSource(garment) : undefined;
  const processingMessage = garment
    ? getGarmentProcessingMessage(garment.image_processing_status, garment.render_status, displayImageSource)
    : null;

  const categorySummary = garment
    ? `${categoryLabel(t, garment.category)}${garment.subcategory ? ` • ${humanize(garment.subcategory)}` : ''}`
    : '';
  const heroDescription = enrichment?.stylist_note
    || [categorySummary, garment?.material ? materialLabel(t, garment.material) : null].filter(Boolean).join(' • ');
  const costCurrency = garment?.purchase_currency || 'SEK';
  const costPerWearDisplay = costPerWear !== null ? `${Math.round(costPerWear)} ${costCurrency}` : 'Add price';
  const lastWornDisplay = usageInsights?.daysSinceLastWorn != null
    ? `${usageInsights.daysSinceLastWorn} days ago`
    : 'Not worn yet';

  const tabs = [
    { key: 'info' as const, label: 'Info' },
    { key: 'outfits' as const, label: 'Outfits' },
    { key: 'similar' as const, label: 'Similar' },
  ];

  const handleToggleLaundry = async () => {
    if (!garment) return;
    try {
      hapticMedium();
      await updateGarment.mutateAsync({ id: garment.id, updates: { in_laundry: !garment.in_laundry } });
      toast.success(garment.in_laundry ? t('garment.available') : t('garment.in_laundry'));
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleMarkWorn = async () => {
    if (!garment) return;
    try {
      hapticSuccess();
      await markWorn.mutateAsync(garment.id);
      toast.success(t('garment.marked'));
    } catch {
      toast.error(t('common.something_wrong'));
    }
  };

  const handleDelete = async () => {
    if (!garment) return;
    try {
      hapticHeavy();
      await deleteGarment.mutateAsync(garment.id);
      toast.success(t('garment.deleted'));
      navigate('/wardrobe');
    } catch {
      toast.error(t('common.something_wrong'));
    }
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
        toast.error('Deep analysis failed. Try again later.');
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

  if (isLoading) {
    return (
      <AppLayout hideNav>
        <PageHeader title="Garment" showBack />
        <div className="page-shell !px-5 !pt-6 page-cluster">
          <Skeleton className="aspect-[4/5] rounded-[2rem]" />
          <Skeleton className="h-32 rounded-[2rem]" />
          <Skeleton className="h-12 rounded-full" />
          <Skeleton className="h-56 rounded-[2rem]" />
        </div>
      </AppLayout>
    );
  }

  if (!garment) {
    return (
      <AppLayout hideNav>
        <PageHeader title="Garment" showBack />
        <div className="page-shell !px-5 !pt-6">
          <EmptyState
            icon={Sparkles}
            title={t('garment.not_found')}
            description="This garment is no longer available in your wardrobe."
            variant="editorial"
            compact
            action={{ label: t('common.back'), onClick: () => navigate('/wardrobe') }}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideNav>
      <PageHeader
        title={garment.title}
        subtitle={categorySummary}
        showBack
        actions={(
          <>
            <Button variant="quiet" size="icon" onClick={() => navigate(`/wardrobe/${garment.id}/edit`)} aria-label="Edit garment">
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="quiet" size="icon" aria-label="Delete garment">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('garment.delete_confirm')}</AlertDialogTitle>
                  <AlertDialogDescription>"{garment.title}" {t('garment.delete_desc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      />

      <div className="page-shell !px-5 !pb-36 !pt-6 page-cluster">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_CURVE }}
        >
          <Card surface="editorial" className="overflow-hidden p-2">
            <div className="relative overflow-hidden rounded-[1.8rem]">
              <LazyImage
                imagePath={displayImagePath}
                alt={garment.title}
                aspectRatio="auto"
                className="aspect-[4/5] w-full !rounded-none object-cover"
              />
              <RenderPendingOverlay renderStatus={garment.render_status} variant="overlay" />

              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-background/88 px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-foreground shadow-[0_8px_18px_rgba(28,25,23,0.08)]">
                    {garment.wear_count || 0} worn
                  </span>
                  {garment.in_laundry ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/88 px-3 py-1 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-foreground shadow-[0_8px_18px_rgba(28,25,23,0.08)]">
                      <WashingMachine className="h-3 w-3" />
                      In laundry
                    </span>
                  ) : null}
                </div>

                {processingMessage ? (
                  <GarmentProcessingBadge
                    status={garment.image_processing_status}
                    renderStatus={garment.render_status}
                    className="bg-background/88"
                    displaySource={displayImageSource}
                  />
                ) : null}
              </div>
            </div>

            <div className="space-y-5 px-3 pb-4 pt-5">
              <PageIntro
                eyebrow={(
                  <>
                    <span className="eyebrow-chip">{categorySummary}</span>
                    {garment.color_primary ? (
                      <span className="eyebrow-chip !bg-secondary/70">{colorLabel(t, garment.color_primary)}</span>
                    ) : null}
                    {garment.material ? (
                      <span className="eyebrow-chip !bg-secondary/70">{materialLabel(t, garment.material)}</span>
                    ) : null}
                  </>
                )}
                title={garment.title}
                description={heroDescription}
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Cost per wear</p>
                  <p className="mt-2 text-[1.45rem] font-semibold tracking-[-0.05em] text-foreground">{costPerWearDisplay}</p>
                </div>
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Last worn</p>
                  <p className="mt-2 text-[1.45rem] font-semibold tracking-[-0.05em] text-foreground">{lastWornDisplay}</p>
                </div>
                <div className="surface-inset rounded-[1.35rem] border p-4">
                  <p className="label-editorial">Monthly rhythm</p>
                  <p className="mt-2 text-[1.45rem] font-semibold tracking-[-0.05em] text-foreground">{usageInsights?.wearFrequency || '0'}</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="surface-inset flex rounded-full border p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab(tab.key);
              }}
              className={`flex-1 rounded-full px-4 py-2.5 text-[0.74rem] font-medium uppercase tracking-[0.16em] transition-all ${
                activeTab === tab.key
                  ? 'bg-foreground text-background shadow-[0_10px_24px_rgba(28,25,23,0.12)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' ? (
          <>
            <Card surface="utility" className="space-y-4 p-5">
              <div className="space-y-2">
                <p className="label-editorial">Details</p>
                {garment.material ? <SpecRow label="Material" value={materialLabel(t, garment.material)} /> : null}
                {garment.fit ? <SpecRow label="Fit" value={fitLabel(t, garment.fit)} /> : null}
                {garment.pattern && garment.pattern !== 'solid' ? <SpecRow label="Pattern" value={patternLabel(t, garment.pattern)} /> : null}
                {seasonParts.length > 0 ? <SpecRow label="Season" value={seasonParts.join(', ')} /> : null}
                {garment.color_secondary ? <SpecRow label="Secondary color" value={colorLabel(t, garment.color_secondary)} /> : null}
              </div>

              <div className="space-y-3 border-t border-border/55 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Purchase price</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a price to make cost-per-wear and value tracking more useful.
                    </p>
                  </div>
                  {!editingPrice ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPriceInput(garment.purchase_price ? String(garment.purchase_price) : '');
                        setEditingPrice(true);
                      }}
                    >
                      {garment.purchase_price ? 'Edit' : 'Add price'}
                    </Button>
                  ) : null}
                </div>

                {editingPrice ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      placeholder="0"
                      className="max-w-[140px]"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        const price = parseFloat(priceInput);
                        if (Number.isNaN(price) || price < 0) return;

                        try {
                          await updateGarment.mutateAsync({ id: garment.id, updates: { purchase_price: price } });
                          setEditingPrice(false);
                        } catch {
                          toast.error(t('common.something_wrong'));
                        }
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="quiet" size="sm" onClick={() => setEditingPrice(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </div>

              {garment.source_url ? (
                <a
                  href={garment.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{t('garment.imported')}</span>
                </a>
              ) : null}

              {garment.ai_analyzed_at ? (
                <p className="text-xs text-muted-foreground">
                  Analyzed {new Date(garment.ai_analyzed_at).toLocaleDateString(getBCP47(locale))}
                </p>
              ) : null}
            </Card>

            <GarmentEnrichmentPanel
              enrichment={enrichment}
              enrichmentStatus={enrichmentStatus}
              isEnrichmentPending={isEnrichmentPending}
              isRetrying={isRetrying}
              onRetryEnrichment={handleRetryEnrichment}
            />

            <Card surface="utility" className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <WashingMachine className="h-4 w-4 text-muted-foreground" />
                    {t('garment.in_laundry')}
                  </div>
                  <p className="text-xs text-muted-foreground">Keep this piece out of outfit generation until it is ready again.</p>
                </div>
                <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/55 pt-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    {t('insights.condition')}
                  </div>
                  {garment.condition_score ? (
                    <p className="text-xs text-muted-foreground">
                      {Number(garment.condition_score).toFixed(1)}/10 • {garment.condition_notes}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Run a quick check to estimate wear and condition.</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
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
                  {assessCondition.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('insights.condition_check')}
                </Button>
              </div>
            </Card>
          </>
        ) : null}

        {activeTab === 'outfits' ? (
          <GarmentOutfitHistory outfitHistory={outfitHistory} usageInsights={usageInsights} />
        ) : null}

        {activeTab === 'similar' ? (
          <GarmentSimilarItems similarGarments={similarGarments} />
        ) : null}
      </div>

      <div className="fixed inset-x-4 bottom-4 z-20" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-md">
          <div className="action-bar-floating flex gap-2 rounded-[1.6rem] p-3">
            <Button variant="outline" onClick={handleMarkWorn} className="flex-1">
              Mark worn
            </Button>
            <Button
              onClick={() => navigate(`/ai/chat${buildStyleFlowSearch(garment.id)}`, { state: buildStyleAroundState(garment.id) })}
              className="flex-1"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Style around this
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
