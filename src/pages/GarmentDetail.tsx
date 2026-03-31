import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
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
import { EASE_CURVE, STAGGER_DELAY, DURATION_SLOW, DURATION_MEDIUM } from '@/lib/motion';
import { buildStyleAroundState, buildStyleFlowSearch } from '@/lib/styleFlowState';
import { AnimatedPage } from '@/components/ui/animated-page';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';

export default function GarmentDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const prefersReduced = useReducedMotion();

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
  void heroDescription;
  const detailMeta = [
    garment?.color_primary ? colorLabel(t, garment.color_primary) : null,
    garment?.material ? materialLabel(t, garment.material) : null,
  ].filter(Boolean).join(' / ');
  const displayCategorySummary = garment
    ? `${categoryLabel(t, garment.category)}${garment.subcategory ? ` / ${humanize(garment.subcategory)}` : ''}`
    : '';
  const cleanHeroDescription = enrichment?.stylist_note
    || [displayCategorySummary, garment?.material ? materialLabel(t, garment.material) : null].filter(Boolean).join(' / ');
  const costCurrency = garment?.purchase_currency || 'SEK';
  const costPerWearDisplay = costPerWear !== null ? `${Math.round(costPerWear)} ${costCurrency}` : t('garment.add_price');
  const lastWornDisplay = usageInsights?.daysSinceLastWorn != null
    ? t('garment.days_ago').replace('{count}', String(usageInsights.daysSinceLastWorn))
    : t('garment.not_worn_yet');

  const tabs = [
    { key: 'info' as const, label: t('garment.tab_info') },
    { key: 'outfits' as const, label: t('garment.tab_outfits') },
    { key: 'similar' as const, label: t('garment.tab_similar') },
  ];

  /* ─── Motion helpers ─── */
  const sectionInitial = prefersReduced ? { opacity: 0 } : { opacity: 0, y: 10 };
  const sectionAnimate = prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const sectionTransition = (delay = 0) => prefersReduced
    ? { duration: 0.1 }
    : { duration: DURATION_SLOW, ease: EASE_CURVE, delay };

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
        toast.error(t('garment.deep_analysis_failed'));
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
      toast.success(t('garment.deep_analysis_complete'));
    } catch {
      await supabase.from('garments').update({ enrichment_status: 'failed' } as Record<string, unknown>).eq('id', garment.id);
      queryClient.invalidateQueries({ queryKey: ['garment', garment.id] });
      toast.error(t('common.something_wrong'));
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout hideNav>
        <PageHeader title={t('garment.garment_title')} showBack />
        <div className="page-shell !px-5 !pt-6 page-cluster">
          <Skeleton className="aspect-[4/5] rounded-[1.25rem]" />
          <Skeleton className="h-8 w-3/4 rounded-full" />
          <Skeleton className="h-5 w-1/2 rounded-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-full" />
            <Skeleton className="h-10 flex-1 rounded-full" />
          </div>
          <Skeleton className="h-32 rounded-[1.25rem]" />
        </div>
      </AppLayout>
    );
  }

  if (!garment) {
    return (
      <AppLayout hideNav>
        <PageHeader title={t('garment.garment_title')} showBack />
        <div className="page-shell !px-5 !pt-6">
          <EmptyState
            icon={Sparkles}
            title={t('garment.not_found')}
            description={t('garment.not_found_desc')}
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
        title={t('garment.garment_title')}
        showBack
        actions={(
          <>
            <Button variant="quiet" size="icon" onClick={() => { hapticLight(); navigate(`/wardrobe/${garment.id}/edit`); }} aria-label={t('garment.edit_garment_aria')}>
              <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="quiet" size="icon" aria-label={t('garment.delete_garment_aria')} onClick={() => hapticLight()}>
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

      <AnimatedPage className="page-shell !px-5 !pb-4 !pt-4 page-cluster">
        {/* ─── Hero Image ─── */}
        <motion.div
          initial={sectionInitial}
          animate={sectionAnimate}
          transition={sectionTransition(0)}
          className="relative overflow-hidden rounded-[1.25rem]"
        >
          <LazyImage
            imagePath={displayImagePath}
            alt={garment.title}
            aspectRatio="auto"
            className="aspect-[4/5] w-full rounded-[1.25rem] object-cover"
          />
          <RenderPendingOverlay renderStatus={garment.render_status} variant="overlay" />

          {/* Overlay badges */}
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {garment.in_laundry ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground backdrop-blur-sm">
                  <WashingMachine className="h-3 w-3" />
                  {t('garment.in_laundry_badge')}
                </span>
              ) : null}
            </div>

            {processingMessage ? (
              <GarmentProcessingBadge
                status={garment.image_processing_status}
                renderStatus={garment.render_status}
                className="bg-background/85 backdrop-blur-sm"
                displaySource={displayImageSource}
              />
            ) : null}
          </div>
        </motion.div>

        {/* ─── Title + Category ─── */}
        <motion.div
          initial={sectionInitial}
          animate={sectionAnimate}
          transition={sectionTransition(STAGGER_DELAY)}
          className="space-y-2 px-1"
        >
          <h1 className="font-display italic text-[1.65rem] leading-[1.15] tracking-[-0.01em] text-foreground">
            {garment.title}
          </h1>
          <p className="label-editorial text-muted-foreground/60 text-[11px] uppercase tracking-[0.16em]">
            {displayCategorySummary}
          </p>
        </motion.div>

        {/* ─── Stats Chips Row ─── */}
        <motion.div
          initial={sectionInitial}
          animate={sectionAnimate}
          transition={sectionTransition(STAGGER_DELAY * 2)}
          className="flex flex-wrap items-center gap-2 px-1"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3.5 py-1.5 text-[12px] font-body text-foreground/80">
            {t('garment.worn_badge').replace('{count}', String(garment.wear_count || 0))}
          </span>
          <span className="inline-flex items-center rounded-full border border-border/60 px-3.5 py-1.5 text-[12px] font-body text-foreground/80">
            {costPerWearDisplay}
          </span>
          <span className="inline-flex items-center rounded-full border border-border/60 px-3.5 py-1.5 text-[12px] font-body text-foreground/80">
            {lastWornDisplay}
          </span>
        </motion.div>

        {/* ─── Season Tags ─── */}
        {seasonParts.length > 0 && (
          <motion.div
            initial={sectionInitial}
            animate={sectionAnimate}
            transition={sectionTransition(STAGGER_DELAY * 3)}
            className="flex flex-wrap gap-2 px-1"
          >
            {seasonParts.map((season) => (
              <span
                key={season}
                className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[11px] font-body font-medium text-foreground/70"
              >
                {season}
              </span>
            ))}
          </motion.div>
        )}

        {/* ─── Provenance / Description ─── */}
        {cleanHeroDescription && (
          <motion.div
            initial={sectionInitial}
            animate={sectionAnimate}
            transition={sectionTransition(STAGGER_DELAY * 4)}
            className="surface-secondary rounded-[1.25rem] p-5 space-y-3"
          >
            <p className="label-editorial text-muted-foreground/50 text-[10px] uppercase tracking-[0.16em]">
              {t('garment.details')}
            </p>
            {detailMeta && (
              <p className="font-body text-[13px] leading-relaxed text-foreground/70">
                {detailMeta}
              </p>
            )}
            {enrichment?.stylist_note && (
              <p className="font-body text-[13.5px] leading-[1.65] text-foreground/80 first-letter:font-display first-letter:italic first-letter:text-[1.6em] first-letter:leading-[1] first-letter:mr-[2px] first-letter:float-left first-letter:text-foreground">
                {enrichment.stylist_note}
              </p>
            )}
          </motion.div>
        )}

        {/* ─── Tab Switcher ─── */}
        <motion.div
          initial={sectionInitial}
          animate={sectionAnimate}
          transition={sectionTransition(STAGGER_DELAY * 5)}
          className="surface-inset flex rounded-full border p-1.5"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab(tab.key);
              }}
              className={`h-11 flex-1 rounded-full px-4 py-2.5 text-[0.74rem] font-medium uppercase tracking-[0.16em] transition-all ${
                activeTab === tab.key
                  ? 'bg-foreground text-background shadow-[0_10px_24px_rgba(28,25,23,0.12)]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ─── Tab: Info ─── */}
        {activeTab === 'info' ? (
          <motion.div
            key="tab-info"
            initial={sectionInitial}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
            className="space-y-4"
          >
            {/* Spec Details Card */}
            <Card surface="utility" className="space-y-0 overflow-hidden rounded-[1.25rem] p-5">
              <p className="label-editorial text-muted-foreground/50 text-[10px] uppercase tracking-[0.16em] mb-2">
                {t('garment.details')}
              </p>
              <div className="divide-y divide-border/40">
                {garment.material ? <SpecRow label={t('garment.material')} value={materialLabel(t, garment.material)} /> : null}
                {garment.fit ? <SpecRow label={t('garment.fit')} value={fitLabel(t, garment.fit)} /> : null}
                {garment.pattern && garment.pattern !== 'solid' ? <SpecRow label={t('garment.pattern')} value={patternLabel(t, garment.pattern)} /> : null}
                {seasonParts.length > 0 ? <SpecRow label={t('garment.season')} value={seasonParts.join(', ')} /> : null}
                {garment.color_secondary ? <SpecRow label={t('garment.secondary_color')} value={colorLabel(t, garment.color_secondary)} /> : null}
              </div>

              {/* Purchase price section */}
              <div className="space-y-3 border-t border-border/40 pt-4 mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-body font-medium text-foreground">{t('garment.purchase_price')}</p>
                    <p className="mt-0.5 text-[11px] font-body text-muted-foreground/60">
                      {t('garment.purchase_price_hint')}
                    </p>
                  </div>
                  {!editingPrice ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full text-[11px]"
                      onClick={() => {
                        hapticLight();
                        setPriceInput(garment.purchase_price ? String(garment.purchase_price) : '');
                        setEditingPrice(true);
                      }}
                    >
                      {garment.purchase_price ? t('garment.edit_button') : t('garment.add_price')}
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
                      className="max-w-[140px] rounded-full"
                    />
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={async () => {
                        hapticLight();
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
                    <Button variant="quiet" size="sm" className="rounded-full" onClick={() => { hapticLight(); setEditingPrice(false); }}>
                      {t('garment.cancel')}
                    </Button>
                  </div>
                ) : null}
              </div>

              {garment.source_url ? (
                <a
                  href={garment.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 pt-3 text-[12px] font-body text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>{t('garment.imported')}</span>
                </a>
              ) : null}

              {garment.ai_analyzed_at ? (
                <p className="text-[11px] font-body text-muted-foreground/50 pt-2">
                  {t('garment.analyzed').replace('{date}', new Date(garment.ai_analyzed_at).toLocaleDateString(getBCP47(locale)))}
                </p>
              ) : null}
            </Card>

            {/* Enrichment Panel */}
            <div className="space-y-4">
              <GarmentEnrichmentPanel
                enrichment={enrichment}
                enrichmentStatus={enrichmentStatus}
                isEnrichmentPending={isEnrichmentPending}
                isRetrying={isRetrying}
                onRetryEnrichment={handleRetryEnrichment}
              />
            </div>

            {/* Quick Actions */}
            <div className="space-y-0 border-t border-border/30 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-2 text-[13px] font-body font-medium text-foreground">
                    <WashingMachine className="h-4 w-4 text-muted-foreground/60" />
                    {t('garment.in_laundry')}
                  </div>
                  <p className="text-[11px] font-body text-muted-foreground/60">{t('garment.laundry_hint')}</p>
                </div>
                <Switch checked={garment.in_laundry || false} onCheckedChange={handleToggleLaundry} disabled={updateGarment.isPending} />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4 mt-4">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-2 text-[13px] font-body font-medium text-foreground">
                    <Shield className="h-4 w-4 text-muted-foreground/60" />
                    {t('insights.condition')}
                  </div>
                  {garment.condition_score ? (
                    <p className="text-[11px] font-body text-muted-foreground/60">
                      {Number(garment.condition_score).toFixed(1)}/10 • {garment.condition_notes}
                    </p>
                  ) : (
                    <p className="text-[11px] font-body text-muted-foreground/60">{t('garment.condition_hint')}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-[11px]"
                  onClick={async () => {
                    hapticLight();
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
            </div>

            {/* Usage Stats */}
            <div className="grid gap-3 grid-cols-3">
              <div className="p-3.5 text-center">
                <p className="label-editorial text-muted-foreground/50 text-[9px] uppercase tracking-[0.14em]">{t('garment.cost_per_wear')}</p>
                <p className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">{costPerWearDisplay}</p>
              </div>
              <div className="p-3.5 text-center">
                <p className="label-editorial text-muted-foreground/50 text-[9px] uppercase tracking-[0.14em]">{t('garment.last_worn_label')}</p>
                <p className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">{lastWornDisplay}</p>
              </div>
              <div className="p-3.5 text-center">
                <p className="label-editorial text-muted-foreground/50 text-[9px] uppercase tracking-[0.14em]">{t('garment.monthly_rhythm')}</p>
                <p className="mt-1.5 text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">{usageInsights?.wearFrequency || '0'}</p>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* ─── Tab: Outfits ─── */}
        {activeTab === 'outfits' ? (
          <motion.div
            key="tab-outfits"
            initial={sectionInitial}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
          >
            <GarmentOutfitHistory outfitHistory={outfitHistory} usageInsights={usageInsights} />
          </motion.div>
        ) : null}

        {/* ─── Tab: Similar ─── */}
        {activeTab === 'similar' ? (
          <motion.div
            key="tab-similar"
            initial={sectionInitial}
            animate={sectionAnimate}
            transition={sectionTransition(0)}
          >
            <GarmentSimilarItems similarGarments={similarGarments} />
          </motion.div>
        ) : null}
      </AnimatedPage>

      {/* ─── Sticky Bottom Action Bar ─── */}
      <div className="sticky bottom-0 z-20 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3">
        <div className="mx-auto max-w-xl">
          <div className="action-bar-floating flex gap-2 rounded-[1.25rem] p-2.5">
            <Button
              variant="outline"
              onClick={() => { hapticLight(); handleMarkWorn(); }}
              className="h-12 shrink-0 rounded-full border-border/35 bg-background/72 px-5"
            >
              {t('garment.mark_worn_button')}
            </Button>
            <Button
              onClick={() => { hapticLight(); navigate(`/ai/chat${buildStyleFlowSearch(garment.id)}`, { state: buildStyleAroundState(garment.id) }); }}
              className="h-12 flex-1 rounded-full"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {t('garment.style_this')}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
