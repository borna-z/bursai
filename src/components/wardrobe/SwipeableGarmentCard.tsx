import { useState, memo, type MouseEvent, type TouchEvent } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Pencil, WashingMachine, Trash2, MoreHorizontal } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Garment } from '@/hooks/useGarments';
import { enqueueRenderJob, RenderEnqueueError } from '@/lib/garmentIntelligence';
import { buildStyleAroundState, buildStyleFlowSearch } from '@/lib/styleFlowState';
import { WardrobeGarmentListLayout } from '@/components/wardrobe/GarmentCardSystem';

const ACTION_WIDTH = 72;
const TOTAL_WIDTH = ACTION_WIDTH * 3;
const SNAP_THRESHOLD = ACTION_WIDTH;

interface SwipeableGarmentCardProps {
  garment: Garment;
  onEdit: () => void;
  onLaundry: () => void;
  onDelete: () => void;
}

export const SwipeableGarmentCard = memo(function SwipeableGarmentCard({
  garment,
  onEdit,
  onLaundry,
  onDelete,
}: SwipeableGarmentCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [enhanceTriggered, setEnhanceTriggered] = useState(false);
  const x = useMotionValue(0);

  const actionsOpacity = useTransform(x, [-TOTAL_WIDTH, -SNAP_THRESHOLD / 2, 0], [1, 0.6, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -SNAP_THRESHOLD || velocity < -300) {
      hapticLight();
      animate(x, -TOTAL_WIDTH, { type: 'spring', stiffness: 400, damping: 35 });
      setIsOpen(true);
      return;
    }

    animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
    setIsOpen(false);
  };

  const close = () => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && !isOpen) {
      hapticLight();
      animate(x, -TOTAL_WIDTH, { type: 'spring', stiffness: 400, damping: 35 });
      setIsOpen(true);
    } else if (e.key === 'Escape' || e.key === 'ArrowRight') {
      close();
    } else if (e.key === 'Enter' && !isOpen) {
      navigate(`/wardrobe/${garment.id}`);
    }
  };

  const handleAction = (action: () => void) => {
    close();
    setTimeout(action, 150);
  };

  const isRenderActive = garment.render_status === 'pending' || garment.render_status === 'rendering';
  const hasRenderedImage = Boolean(garment.rendered_image_path);
  const renderStatus = garment.render_status;

  // Show "Studio photo" when no rendered image exists and render is not in flight
  const showGenerateAction = !hasRenderedImage && !isRenderActive && !enhanceTriggered
    && (renderStatus === 'none' || renderStatus === 'failed' || renderStatus === 'skipped');
  // Show "Regenerate" when a rendered image already exists and render is not in flight
  const showRegenerateAction = hasRenderedImage && !isRenderActive && !enhanceTriggered;
  const showEnhancingAction = isRenderActive || enhanceTriggered;

  const handleRender = async (event: MouseEvent | TouchEvent) => {
    event.stopPropagation();
    hapticLight();
    setEnhanceTriggered(true);
    // P5: enqueue a render job via the durable queue. Returns fast
    // (~200-300ms) once the row is INSERTed; worker picks it up from
    // either the internal POST kickoff or the pg_cron safety net.
    //
    // Retry contract: a distinct tap of "Studio photo" is a new user
    // intent → new nonce (the default). A transport-level 5xx gets one
    // retry with the SAME nonce so a reserve-succeeded-insert-failed
    // state can recover without orphaning the reservation.
    try {
      await enqueueRenderJob(garment.id, 'retry');
    } catch (err) {
      if (err instanceof RenderEnqueueError) {
        if (err.status === 402) {
          // Trial / insufficient — surface via upgrade CTA (P10/P11).
          setEnhanceTriggered(false);
          return;
        }
        if (err.status >= 500 && err.clientNonce) {
          try {
            await enqueueRenderJob(garment.id, 'retry', { clientNonce: err.clientNonce });
            return;
          } catch {
            setEnhanceTriggered(false);
            return;
          }
        }
      }
      setEnhanceTriggered(false);
    }
  };

  const handleStyleAround = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/ai/chat${buildStyleFlowSearch(garment.id)}`, { state: buildStyleAroundState(garment.id) });
  };

  const secondaryAction = showEnhancingAction ? (
    <span className="inline-flex h-10 items-center justify-center rounded-[16px] border border-border/45 bg-background/68 px-3.5 text-[11px] font-semibold text-foreground/45">
      Refining...
    </span>
  ) : showRegenerateAction ? (
    <button
      type="button"
      onClick={handleRender}
      className="inline-flex h-10 items-center justify-center rounded-[16px] border border-border/45 bg-background/82 px-3.5 text-[11px] font-semibold text-foreground/68 transition-all duration-200 hover:-translate-y-0.5 hover:bg-background"
    >
      Regenerate
    </button>
  ) : showGenerateAction ? (
    <button
      type="button"
      onClick={handleRender}
      className="inline-flex h-10 items-center justify-center rounded-[16px] border border-border/45 bg-background/82 px-3.5 text-[11px] font-semibold text-foreground/68 transition-all duration-200 hover:-translate-y-0.5 hover:bg-background"
    >
      Studio photo
    </button>
  ) : null;

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={garment.title || 'Garment'}
      onKeyDown={handleKeyDown}
      className="group relative overflow-hidden rounded-[28px]"
    >
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch gap-1.5 rounded-[28px] bg-card/86 p-1.5"
        style={{ opacity: actionsOpacity, width: TOTAL_WIDTH }}
      >
        <button
          onClick={() => handleAction(onEdit)}
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] border border-border/35 bg-background/88 text-foreground/72 transition-colors hover:bg-background"
          aria-label={t('common.edit')}
        >
          <Pencil className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('common.edit')}</span>
        </button>
        <button
          onClick={() => handleAction(onLaundry)}
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] border border-border/35 bg-secondary/80 text-foreground/72 transition-colors hover:bg-secondary"
          aria-label={t('wardrobe.laundry')}
        >
          <WashingMachine className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('wardrobe.laundry')}</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] border border-destructive/15 bg-destructive/10 text-destructive transition-colors hover:bg-destructive/15"
          aria-label={t('wardrobe.remove')}
        >
          <Trash2 className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('wardrobe.remove')}</span>
        </button>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -TOTAL_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }

          navigate(`/wardrobe/${garment.id}`);
        }}
        aria-hidden="true"
        className="relative cursor-grab active:cursor-grabbing will-change-transform"
      >
        <WardrobeGarmentListLayout
          garment={garment}
          t={t}
          onStyleAround={handleStyleAround}
          secondaryAction={secondaryAction}
        />

        {/* Overflow menu for keyboard/focus users */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label={t('common.actions') || 'Actions'}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { hapticLight(); handleAction(onEdit); }}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { hapticLight(); handleAction(onLaundry); }}>
                <WashingMachine className="mr-2 h-4 w-4" />
                {t('wardrobe.laundry')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { hapticLight(); handleAction(onDelete); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('wardrobe.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </div>
  );
});
