import { Sparkles, Shield, Layers, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { confidenceLabel } from '@/lib/humanize';

/* ─── Enrichment data extracted from ai_raw ─── */
export interface EnrichmentData {
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

// eslint-disable-next-line react-refresh/only-export-components
export function extractEnrichment(aiRaw: unknown): EnrichmentData | null {
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
export function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 min-h-[48px]">
      <span className="font-body text-[11px] text-muted-foreground">{label}</span>
      <span className="font-body text-[11px] text-foreground capitalize">{value}</span>
    </div>
  );
}

export type EnrichmentStatus = 'none' | 'pending' | 'in_progress' | 'complete' | 'failed';

interface GarmentEnrichmentPanelProps {
  enrichment: EnrichmentData | null;
  enrichmentStatus: EnrichmentStatus;
  isEnrichmentPending: boolean;
  isRetrying: boolean;
  onRetryEnrichment: () => void;
}

export function GarmentEnrichmentPanel({
  enrichment,
  enrichmentStatus,
  isEnrichmentPending,
  isRetrying,
  onRetryEnrichment,
}: GarmentEnrichmentPanelProps) {
  const { t } = useLanguage();
  return (
    <>
      {/* Enrichment pending */}
      {isEnrichmentPending && !enrichment && (
        <div className="p-4 surface-utility">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-foreground/60 animate-pulse" />
            <p className="font-body text-xs text-foreground/70 font-medium m-0">{t('garment.enrichment.deep_analysis_progress')}</p>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      )}

      {/* Enrichment failed */}
      {enrichmentStatus === 'failed' && !enrichment && (
        <div className="p-4 surface-utility flex items-center justify-between">
          <p className="font-body text-xs text-foreground/70 m-0">{t('garment.enrichment.analysis_incomplete')}</p>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={onRetryEnrichment} disabled={isRetrying}>
            {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {t('garment.enrichment.retry')}
          </Button>
        </div>
      )}

      {/* Garment intelligence — enrichment details */}
      {enrichment && (enrichment.silhouette || enrichment.visual_weight || enrichment.texture_intensity || enrichment.drape) && (
        <div className="border-t border-foreground/[0.06]">
          <p className="font-body text-[9px] uppercase tracking-[0.08em] text-foreground/[0.38] py-[10px] pb-1">
            {t('garment.enrichment.intelligence')}
          </p>
          {enrichment.silhouette && <SpecRow label={t('garment.enrichment.silhouette')} value={enrichment.silhouette} />}
          {enrichment.visual_weight && <SpecRow label={t('garment.enrichment.visual_weight')} value={enrichment.visual_weight} />}
          {enrichment.texture_intensity && <SpecRow label={t('garment.enrichment.texture')} value={enrichment.texture_intensity} />}
          {enrichment.drape && <SpecRow label={t('garment.enrichment.drape')} value={enrichment.drape} />}
          {enrichment.shoulder_structure && <SpecRow label={t('garment.enrichment.shoulder')} value={enrichment.shoulder_structure} />}
          {enrichment.hem_detail && <SpecRow label={t('garment.enrichment.hem')} value={enrichment.hem_detail} />}
        </div>
      )}

      {/* Construction specs */}
      {enrichment && (enrichment.neckline || enrichment.sleeve_length || enrichment.garment_length || enrichment.closure || enrichment.fabric_weight || enrichment.layering_role || enrichment.rise || enrichment.leg_shape) && (
        <div className="border-t border-foreground/[0.06]">
          <p className="font-body text-[9px] uppercase tracking-[0.08em] text-foreground/[0.38] py-[10px] pb-1">
            {t('garment.enrichment.construction')}
          </p>
          {enrichment.neckline && <SpecRow label={t('garment.enrichment.neckline')} value={enrichment.neckline} />}
          {enrichment.sleeve_length && <SpecRow label={t('garment.enrichment.sleeve')} value={enrichment.sleeve_length} />}
          {enrichment.garment_length && <SpecRow label={t('garment.enrichment.length')} value={enrichment.garment_length} />}
          {enrichment.closure && <SpecRow label={t('garment.enrichment.closure')} value={enrichment.closure} />}
          {enrichment.fabric_weight && <SpecRow label={t('garment.enrichment.weight')} value={enrichment.fabric_weight} />}
          {enrichment.layering_role && <SpecRow label={t('garment.enrichment.layering')} value={enrichment.layering_role} />}
          {enrichment.rise && <SpecRow label={t('garment.enrichment.rise')} value={enrichment.rise} />}
          {enrichment.leg_shape && <SpecRow label={t('garment.enrichment.leg_shape')} value={enrichment.leg_shape} />}
        </div>
      )}

      {/* Style archetype + tags */}
      {(enrichment?.style_archetype || (enrichment?.style_tags && enrichment.style_tags.length > 0)) && (
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.08em] text-foreground/[0.38] mb-1.5">
            {t('garment.enrichment.style')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment?.style_archetype && (
              <span className="bg-foreground text-background px-2 py-[3px] font-body text-[10px] capitalize">
                {enrichment.style_archetype}
              </span>
            )}
            {enrichment?.style_tags?.map((tag) => (
              <span key={tag} className="bg-secondary/45 text-foreground px-2 py-[3px] font-body text-[10px] capitalize">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Occasion tags */}
      {enrichment?.occasion_tags && enrichment.occasion_tags.length > 0 && (
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.08em] text-foreground/[0.38] mb-1.5">
            {t('garment.enrichment.occasions')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.occasion_tags.map((tag) => (
              <span key={tag} className="bg-secondary/45 text-foreground/70 px-2 py-[3px] font-body text-[10px] capitalize">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Versatility */}
      {enrichment?.versatility_score != null && (
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-foreground/40" />
          <span className="font-body text-[11px] text-foreground">
            {t('garment.enrichment.versatility')}: {enrichment.versatility_score}/10
          </span>
          {enrichment.color_harmony_notes && (
            <span className="font-body text-[10px] text-foreground/50">
              — {enrichment.color_harmony_notes}
            </span>
          )}
        </div>
      )}

      {/* Confidence */}
      {enrichment?.confidence != null && (
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: enrichment.confidence >= 0.85 ? '#10b981' : enrichment.confidence >= 0.6 ? '#f59e0b' : 'rgba(28,25,23,0.3)',
            }}
          />
          <span className="font-body text-[10px] text-foreground/50">
            {confidenceLabel(enrichment.confidence).label} · {Math.round(enrichment.confidence * 100)}%
          </span>
        </div>
      )}

      {/* Care instructions */}
      {enrichment?.care_instructions && enrichment.care_instructions.length > 0 && (
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.08em] text-foreground/[0.38] mb-1.5">
            {t('garment.enrichment.care')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {enrichment.care_instructions.map((item) => (
              <span key={item} className="bg-secondary/45 text-foreground/70 px-2 py-[3px] font-body text-[10px] capitalize">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
