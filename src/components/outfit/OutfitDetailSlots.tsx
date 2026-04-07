import { hapticLight } from '@/lib/haptics';
import { stripBrands } from '@/lib/stripBrands';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Shirt } from 'lucide-react';
import { SwapLoadingState } from '@/components/ui/SwapLoadingState';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { RenderPendingOverlay } from '@/components/wardrobe/RenderPendingOverlay';
import type { SwapCandidate, SwapMode } from '@/hooks/useSwapGarment';

/* ── Swap Sheet ─────────────────────────────────────── */

export interface SwapSheetProps {
  isOpen: boolean;
  onClose: () => void;
  slot: string;
  mode: SwapMode;
  onModeChange: (mode: SwapMode) => void;
  candidates: SwapCandidate[];
  isLoading: boolean;
  onSelect: (garmentId: string) => void;
  isSwapping: boolean;
  t: (key: string) => string;
}

export function SwapSheet({
  isOpen,
  onClose,
  slot,
  mode,
  onModeChange,
  candidates,
  isLoading,
  onSelect,
  isSwapping,
  t,
}: SwapSheetProps) {
  const slotLabel = t(`outfit.slot.${slot}`) || slot;

  const modeDescriptions: Record<string, string> = {
    safe: t('swap.mode_safe_desc'),
    bold: t('swap.mode_bold_desc'),
    fresh: t('swap.mode_fresh_desc'),
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[72vh]">
        <SheetHeader>
          <SheetTitle>{t('outfit.swap')} {slotLabel}</SheetTitle>
          <SheetDescription>{t('outfit.swap_description')}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {(['safe', 'bold', 'fresh'] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? 'default' : 'outline'}
                size="sm"
                onClick={() => { hapticLight(); onModeChange(m); }}
                className="rounded-[1.25rem]"
              >
                {m === 'safe' ? 'Safe' : m === 'bold' ? 'Bold' : 'Eco'}{' '}
                {t(`swap.mode_${m}`) || m.charAt(0).toUpperCase() + m.slice(1)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60 text-center">
            {modeDescriptions[mode]}
          </p>
        </div>

        <div className="mt-4 pb-8 space-y-2 overflow-y-auto">
          {isLoading ? (
            <SwapLoadingState />
          ) : candidates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('outfit.no_alternatives')}</p>
              <p className="text-sm mt-1">{t('outfit.add_more')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {candidates.map((candidate, idx) => (
                <button
                  key={candidate.garment.id}
                  onClick={() => { hapticLight(); onSelect(candidate.garment.id); }}
                  disabled={isSwapping}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-[1.25rem] transition-all hover:bg-secondary/80 bg-secondary/40 active:scale-[0.99]",
                    idx === 0 && "ring-1 ring-primary/20 bg-primary/5",
                    isSwapping && "opacity-50"
                  )}
                >
                  <LazyImageSimple
                    imagePath={getPreferredGarmentImagePath(candidate.garment)}
                    alt={candidate.garment.title}
                    className="w-[60px] h-[60px] min-w-[60px] min-h-[60px] rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-sm truncate">{stripBrands(candidate.garment.title)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{candidate.garment.color_primary}</p>
                    {candidate.swap_reason && (
                      <p className="text-[11px] text-primary/70 mt-0.5 leading-snug line-clamp-1 italic">
                        {candidate.swap_reason}
                      </p>
                    )}
                  </div>
                  {idx === 0 && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {t('swap.best_match')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Garment Slot (editorial card) ─────────────── */

function getLayerRoleLabel(role: string, t: (key: string) => string): string {
  if (role === 'standalone') return '';
  return t(`outfit.layer_role.${role}`) || role;
}

export interface SlotRowProps {
  slot: string;
  garmentId: string;
  garmentTitle?: string;
  garmentColor?: string;
  imagePath?: string;
  renderStatus?: string | null;
  onSwap: () => void;
  t: (key: string) => string;
  layerRole?: string;
}

export function SlotRow({ slot, garmentId, garmentTitle, garmentColor, imagePath, renderStatus, onSwap, t, layerRole }: SlotRowProps) {
  const navigate = useNavigate();
  // Use layering role label for top-area slots when available
  const isLayeredSlot = ['top', 'outerwear'].includes(slot);
  const roleLabel = isLayeredSlot && layerRole && getLayerRoleLabel(layerRole, t)
    ? getLayerRoleLabel(layerRole, t)
    : (t(`outfit.slot.${slot}`) || slot);

  const categorySlotLabel = t(`outfit.slot.${slot}`) || slot;

  return (
    <div className="rounded-[1.25rem] p-3 flex items-center gap-4 mb-3 group border border-border/40">
      <div
        className="relative w-16 h-20 rounded-[1rem] overflow-hidden flex-shrink-0 cursor-pointer bg-muted/20"
        onClick={() => navigate(`/wardrobe/${garmentId}`)}
      >
        <LazyImageSimple
          imagePath={imagePath}
          alt={garmentTitle || slot}
          className="w-full h-full object-cover"
          fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/20" />}
        />
        <RenderPendingOverlay renderStatus={renderStatus} variant="overlay" className="[&>span]:hidden" />
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/wardrobe/${garmentId}`)}>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-body mb-0.5">
          {roleLabel}
        </p>
        <p className="font-medium text-[14px] truncate tracking-tight">{stripBrands(garmentTitle || '') || t('outfit.unknown')}</p>
        {garmentColor && <p className="text-[11px] text-muted-foreground/60 capitalize mt-0.5 font-body">{garmentColor}</p>}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); hapticLight(); onSwap(); }}
        className="p-2.5 rounded-full bg-background/60 hover:bg-background transition-all active:scale-95 flex-shrink-0 opacity-50 group-hover:opacity-100"
        aria-label={t('outfit.swap_out')}
      >
        <RefreshCw className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
