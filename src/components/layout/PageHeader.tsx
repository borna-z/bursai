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
  sticky?: boolean;
}

export function PageHeader({
  title, subtitle, eyebrow, showBack = false, actions, className, sticky = true,
}: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={cn('topbar-frost z-20', sticky && 'sticky top-0', className)}>
      <div className={cn(
        'mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5',
        subtitle || eyebrow ? 'min-h-[72px] py-3' : 'h-[64px]',
      )}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={() => { hapticLight(); navigate(-1); }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/35 bg-background/80 active:scale-95 transition-transform"
              aria-label="Go back"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="caption-upper mb-0.5 text-muted-foreground/45">{eyebrow}</p>}
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="truncate font-['Playfair_Display'] italic text-[1.3rem] font-medium leading-tight text-foreground"
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p className="mt-0.5 max-w-[30ch] text-[0.76rem] leading-relaxed text-muted-foreground/60">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
