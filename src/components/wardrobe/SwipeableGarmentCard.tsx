import { useState, useRef, useMemo, memo } from 'react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Pencil, WashingMachine, Trash2, Shirt } from 'lucide-react';
import { LazyImageSimple } from '@/components/ui/lazy-image';
import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import type { Garment } from '@/hooks/useGarments';
import { getPreferredGarmentImagePath } from '@/lib/garmentImage';
import { GarmentProcessingBadge } from '@/components/wardrobe/GarmentProcessingBadge';

const ACTION_WIDTH = 72; // width per action button
const TOTAL_WIDTH = ACTION_WIDTH * 3; // 3 actions
const SNAP_THRESHOLD = ACTION_WIDTH; // drag past 1 button to reveal

interface SwipeableGarmentCardProps {
  garment: Garment;
  onEdit: () => void;
  onLaundry: () => void;
  onDelete: () => void;
}

export const SwipeableGarmentCard = memo(function SwipeableGarmentCard({ garment, onEdit, onLaundry, onDelete }: SwipeableGarmentCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const isNew = useMemo(() => {
    if (!garment.created_at) return false;
    return Date.now() - new Date(garment.created_at).getTime() < 24 * 60 * 60 * 1000;
  }, [garment.created_at]);
  const [isOpen, setIsOpen] = useState(false);
  const displayImagePath = getPreferredGarmentImagePath(garment);
  const x = useMotionValue(0);
  const constraintRef = useRef<HTMLDivElement>(null);

  // Opacity for action buttons based on drag distance
  const actionsOpacity = useTransform(x, [-TOTAL_WIDTH, -SNAP_THRESHOLD / 2, 0], [1, 0.6, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -SNAP_THRESHOLD || velocity < -300) {
      hapticLight();
      animate(x, -TOTAL_WIDTH, { type: 'spring', stiffness: 400, damping: 35 });
      setIsOpen(true);
    } else {
      // Snap closed
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
      setIsOpen(false);
    }
  };

  const close = () => {
    animate(x, 0, { type: 'spring', stiffness: 400, damping: 35 });
    setIsOpen(false);
  };

  const handleAction = (action: () => void) => {
    close();
    // Small delay so the close animation starts before the action
    setTimeout(action, 150);
  };

  return (
    <div ref={constraintRef} className="relative overflow-hidden rounded-xl">
      {/* Action buttons behind */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ opacity: actionsOpacity, width: TOTAL_WIDTH }}
      >
        <button
          onClick={() => handleAction(onEdit)}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-accent text-accent-foreground"
          aria-label={t('common.edit')}
        >
          <Pencil className="w-4 h-4" />
          <span className="text-[10px] font-medium">{t('common.edit')}</span>
        </button>
        <button
          onClick={() => handleAction(onLaundry)}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-warning text-warning-foreground"
          aria-label={t('wardrobe.laundry')}
        >
          <WashingMachine className="w-4 h-4" />
          <span className="text-[10px] font-medium">{t('wardrobe.laundry')}</span>
        </button>
        <button
          onClick={() => handleAction(onDelete)}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground"
          aria-label={t('wardrobe.remove')}
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">{t('wardrobe.remove')}</span>
        </button>
      </motion.div>

      {/* Draggable card */}
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
          } else {
            navigate(`/wardrobe/${garment.id}`);
          }
        }}
        className={cn(
          'relative flex items-center gap-3 p-3 glass-card rounded-xl text-left cursor-grab active:cursor-grabbing will-change-transform',
          garment.in_laundry && 'opacity-60'
        )}
      >
        <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-lg">
          <LazyImageSimple
            imagePath={displayImagePath}
            alt={garment.title}
            className="w-14 h-14 rounded-lg shrink-0"
            fallbackIcon={<Shirt className="w-5 h-5 text-muted-foreground/30" />}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{garment.title}</p>
            {isNew && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                {t('wardrobe.new_badge')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {t(`garment.category.${garment.category}`)} · {t(`color.${garment.color_primary}`)}
          </p>
          <GarmentProcessingBadge
            status={garment.image_processing_status}
            renderStatus={garment.render_status}
            className="mt-1"
          />
          {(garment.formality != null || ((garment.ai_raw as Record<string, unknown>)?.occasions as string[] | undefined)?.length) && (
            <div className="flex flex-row items-center gap-2 max-h-[28px]">
              {garment.formality != null && (
                <div className="flex flex-row items-center gap-[4px]">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'inline-block w-[6px] h-[6px] rounded-full',
                        i < garment.formality! ? 'bg-foreground/70' : 'bg-foreground/10'
                      )}
                    />
                  ))}
                </div>
              )}
              {((garment.ai_raw as Record<string, unknown>)?.occasions as string[] | undefined)?.slice(0, 2).map((occ) => (
                <Chip
                  key={occ}
                  size="sm"
                  variant="outline"
                  className="text-[11px] py-0 cursor-default pointer-events-none"
                >
                  {occ}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});
