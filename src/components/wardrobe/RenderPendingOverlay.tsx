import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface RenderPendingOverlayProps {
  renderStatus?: string | null;
  /** 'badge' shows a small corner badge; 'overlay' adds shimmer over the image area */
  variant?: 'badge' | 'overlay';
  className?: string;
}

/**
 * Subtle overlay / badge shown while a garment's ghost-mannequin render is
 * being generated (render_status = 'pending' | 'rendering').
 *
 * - `overlay` variant: translucent shimmer + small label, meant to sit on top
 *   of the image area (absolute-positioned).
 * - `badge` variant: compact pill badge for list rows or metadata sections.
 */
export function RenderPendingOverlay({
  renderStatus,
  variant = 'overlay',
  className,
}: RenderPendingOverlayProps) {
  const isPending = renderStatus === 'pending' || renderStatus === 'rendering';
  if (!isPending) return null;

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/20',
          className,
        )}
      >
        <Sparkles className="w-2.5 h-2.5 animate-pulse" />
        Rendering…
      </span>
    );
  }

  // overlay variant
  return (
    <div
      className={cn(
        'absolute inset-0 z-[5] pointer-events-none overflow-hidden rounded-[inherit]',
        className,
      )}
    >
      {/* Subtle shimmer sweep */}
      <div className="absolute inset-0 skeleton-shimmer opacity-40" />

      {/* Small badge in bottom-left */}
      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/70 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/20">
        <Sparkles className="w-2.5 h-2.5 animate-pulse" />
        Rendering…
      </span>
    </div>
  );
}
