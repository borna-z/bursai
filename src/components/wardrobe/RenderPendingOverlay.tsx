import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface RenderPendingOverlayProps {
  renderStatus?: string | null;
  /** 'badge' shows a small corner badge; 'overlay' adds shimmer over the image area */
  variant?: 'badge' | 'overlay';
  /** Wave 3-B F20: show a time-estimate hint below the label in the overlay variant */
  showHint?: boolean;
  className?: string;
}

/**
 * Subtle overlay / badge shown while a garment's ghost-mannequin render is
 * being generated (render_status = 'pending' | 'rendering').
 *
 * Wave 3-B F20+F21:
 *  - Label + hint now use i18n keys (`render.pending_label`, `render.pending_hint`)
 *    instead of hardcoded English strings.
 *  - Overlay variant can show a "Takes about 20 seconds" hint so the user
 *    has a sense of how long to wait. Badge variant stays compact (no hint).
 */
export function RenderPendingOverlay({
  renderStatus,
  variant = 'overlay',
  showHint = true,
  className,
}: RenderPendingOverlayProps) {
  const { t } = useLanguage();
  const isPending = renderStatus === 'pending' || renderStatus === 'rendering';
  if (!isPending) return null;

  const label = t('render.pending_label');
  const hint = t('render.pending_hint');

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/20',
          className,
        )}
      >
        <Sparkles className="w-2.5 h-2.5 animate-pulse" />
        {label}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-[5] pointer-events-none overflow-hidden rounded-[inherit]',
        className,
      )}
    >
      <div className="absolute inset-0 skeleton-shimmer opacity-40" />

      <div className="absolute bottom-2 left-2 inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/20">
          <Sparkles className="w-2.5 h-2.5 animate-pulse" />
          {label}
        </span>
        {showHint && (
          <span className="px-2 text-[9px] font-medium text-muted-foreground/70 lowercase tracking-[0.04em]">
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}
