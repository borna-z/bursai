import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  sticky?: boolean;
}

export function PageHeader({
  title, subtitle, eyebrow, showBack = false, actions, className, titleClassName, sticky = true,
}: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        sticky
          ? 'topbar-frost sticky top-0 z-20'
          : 'relative z-10',
        className,
      )}
    >
      <div className={cn(
        'mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 sm:px-5',
        subtitle || eyebrow
          ? (sticky ? 'min-h-[68px] py-2.5' : 'min-h-[60px] py-1.5')
          : (sticky ? 'h-[60px]' : 'min-h-[52px] py-1'),
      )}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => { hapticLight(); navigate(-1); }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/88 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="caption-upper mb-0.5 text-muted-foreground/60">{eyebrow}</p>}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className={cn("truncate font-display italic text-[1.24rem] font-medium leading-tight text-foreground sm:text-[1.3rem]", titleClassName)}
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p className="mt-0.5 max-w-[30ch] text-[0.78rem] leading-5 text-muted-foreground/62">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
