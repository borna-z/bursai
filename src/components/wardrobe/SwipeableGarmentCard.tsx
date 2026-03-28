import { useState, memo, type MouseEvent, type TouchEvent } from 'react';
import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Pencil, WashingMachine, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import type { Garment } from '@/hooks/useGarments';
import { triggerGarmentPostSaveIntelligence } from '@/lib/garmentIntelligence';
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

  const handleAction = (action: () => void) => {
    close();
    setTimeout(action, 150);
  };

  const showEnhanceAction = !garment.rendered_image_path && garment.render_status !== 'processing' && !enhanceTriggered;
  const showEnhancingAction = garment.render_status === 'processing' || enhanceTriggered;

  const handleEnhance = (event: MouseEvent | TouchEvent) => {
    event.stopPropagation();
    hapticLight();
    setEnhanceTriggered(true);
    triggerGarmentPostSaveIntelligence({
      garmentId: garment.id,
      storagePath: garment.image_path,
      source: 'manual_enhance',
      imageProcessing: { mode: 'full' },
    });
  };

  const handleStyleAround = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigate(`/ai/chat${buildStyleFlowSearch(garment.id)}`, { state: buildStyleAroundState(garment.id) });
  };

  const secondaryAction = showEnhanceAction ? (
    <button
      type="button"
      onClick={handleEnhance}
      className="inline-flex h-10 items-center justify-center rounded-full border border-[#1C1917]/12 bg-white/62 px-3.5 text-[11px] font-semibold text-[#1C1917]/72 transition-colors hover:bg-white/80"
    >
      Enhance
    </button>
  ) : showEnhancingAction ? (
    <span className="inline-flex h-10 items-center justify-center rounded-full border border-[#1C1917]/12 bg-white/40 px-3.5 text-[11px] font-semibold text-[#1C1917]/45">
      Enhancing...
    </span>
  ) : null;

  return (
    <div className="relative overflow-hidden rounded-[26px]">
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ opacity: actionsOpacity, width: TOTAL_WIDTH }}
      >
        <button
          onClick={() => handleAction(onEdit)}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-accent text-accent-foreground"
          aria-label={t('common.edit')}
        >
          <Pencil className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('common.edit')}</span>
        </button>
        <button
          onClick={() => handleAction(onLaundry)}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-warning text-warning-foreground"
          aria-label={t('wardrobe.laundry')}
        >
          <WashingMachine className="h-4 w-4" />
          <span className="text-[10px] font-medium">{t('wardrobe.laundry')}</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground"
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
        className="relative cursor-grab active:cursor-grabbing will-change-transform"
      >
        <WardrobeGarmentListLayout
          garment={garment}
          t={t}
          onStyleAround={handleStyleAround}
          secondaryAction={secondaryAction}
        />
      </motion.div>
    </div>
  );
});
