import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';

export type PageHeaderVariant = 'solid' | 'overlay';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  /**
   * Visual variant.
   *
   * - `solid` (default): frost background, border-bottom, full editorial chrome.
   *   Use for hub, list, form, and settings pages.
   * - `overlay`: transparent background, circular blur-pill back button, sits
   *   over a hero image. Use for detail pages with full-bleed hero photography
   *   (GarmentDetail, OutfitDetail, PublicProfile).
   */
  variant?: PageHeaderVariant;
  /**
   * @deprecated The header is always sticky. This prop is retained only for
   * backward compatibility with `src/pages/Insights.tsx` (frozen file) and
   * has no effect — the header always sticks to the top of its scroll
   * container. Remove from new callers.
   */
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  showBack = false,
  actions,
  className,
  titleClassName,
  variant = 'solid',
}: PageHeaderProps) {
  const navigate = useNavigate();

  const isOverlay = variant === 'overlay';

  return (
    <header
      className={cn(
        'sticky top-0',
        isOverlay ? 'bg-transparent' : 'topbar-frost',
        className,
      )}
      style={{ zIndex: 'var(--z-header)' } as React.CSSProperties}
      data-variant={variant}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-[var(--page-px)]',
          subtitle || eyebrow ? 'min-h-[68px] py-2.5' : 'h-[60px]',
        )}
        style={{ paddingTop: '12px' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => { hapticLight(); navigate(-1); }}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-95 transition-transform',
                isOverlay
                  ? 'border border-white/30 bg-black/35 text-white backdrop-blur-md'
                  : 'border border-border/70 bg-background/88 text-foreground',
              )}
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  'caption-upper mb-0.5',
                  isOverlay ? 'text-white/70' : 'text-muted-foreground/60',
                )}
              >
                {eyebrow}
              </p>
            )}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'truncate font-display italic text-[1.24rem] font-medium leading-tight sm:text-[1.3rem]',
                  isOverlay ? 'text-white' : 'text-foreground',
                  titleClassName,
                )}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p
                className={cn(
                  'mt-0.5 max-w-[30ch] text-[0.78rem] leading-5',
                  isOverlay ? 'text-white/70' : 'text-muted-foreground/62',
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
