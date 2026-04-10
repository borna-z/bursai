import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { EASE_CURVE } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface GarmentSavedCardProps {
  garmentId: string;
  imagePath: string;
  title: string;
  category: string;
  colorPrimary: string;
  studioQualityEnabled: boolean;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const DEFAULT_AUTO_DISMISS_MS = 2800;

export function GarmentSavedCard({
  garmentId,
  imagePath,
  title,
  category,
  colorPrimary,
  studioQualityEnabled,
  onDismiss,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
}: GarmentSavedCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const publicUrl = useMemo(() => {
    if (!imagePath) return '';
    return supabase.storage.from('garments').getPublicUrl(imagePath).data.publicUrl;
  }, [imagePath]);

  const resolveCopy = useCallback(
    (key: string, fallback: string) => {
      const translated = t(key);
      return translated && translated !== key ? translated : fallback;
    },
    [t],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, autoDismissMs);
    return clearTimer;
  }, [autoDismissMs, dismiss, clearTimer]);

  const handleCardTap = useCallback(() => {
    clearTimer();
    dismiss();
  }, [clearTimer, dismiss]);

  const handleViewInWardrobe = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      clearTimer();
      dismissedRef.current = true;
      setVisible(false);
      navigate('/wardrobe');
    },
    [clearTimer, navigate],
  );

  const metaLine = [category, colorPrimary].filter(Boolean).join(' · ');

  const statusLabel = studioQualityEnabled
    ? resolveCopy('garment_saved.studio_pending', 'Studio render pending')
    : resolveCopy('garment_saved.processing', 'Processing details');

  const initial = prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12 };
  const animate = prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const exit = { opacity: 0 };

  return (
    <AnimatePresence onExitComplete={onDismiss}>
      {visible && (
        <motion.div
          key={garmentId}
          role="status"
          aria-live="polite"
          onClick={handleCardTap}
          initial={initial}
          animate={animate}
          exit={exit}
          transition={{ type: 'tween', ease: EASE_CURVE, duration: 0.28 }}
          className={cn(
            'relative flex items-center gap-3 cursor-pointer select-none',
            'rounded-[1.25rem] border border-border/50 bg-background/88 p-3 pr-4',
            'shadow-[0_18px_40px_rgba(28,25,23,0.10)] backdrop-blur-xl',
          )}
          style={{ transitionDuration: '0.18s' }}
        >
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-[1rem] bg-muted">
            {publicUrl ? (
              <img
                src={publicUrl}
                alt={title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            {metaLine && (
              <p className="truncate text-[11px] text-muted-foreground">{metaLine}</p>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium',
                  studioQualityEnabled
                    ? 'border border-accent/20 bg-accent/15 text-accent'
                    : 'border border-border/40 bg-foreground/8 text-muted-foreground',
                )}
              >
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={handleViewInWardrobe}
                className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
              >
                {resolveCopy('garment_saved.view_in_wardrobe', 'View in wardrobe')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GarmentSavedCard;
