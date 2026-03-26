import { Sparkles, Shield, Layers, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0',
    }}>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(28,25,23,0.45)' }}>{label}</span>
      <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: '#1C1917', textTransform: 'capitalize' }}>{value}</span>
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
  return (
    <>
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
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={onRetryEnrichment} disabled={isRetrying}>
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
    </>
  );
}
