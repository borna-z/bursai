import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageHeader({ 
  title, 
  subtitle,
  showBack = false, 
  actions, 
  className,
  sticky = true 
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header 
      className={cn(
        'topbar-frost z-20',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className={cn(
        'mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4',
        subtitle ? 'min-h-[76px] py-3' : 'h-[68px]'
      )}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showBack && (
            <Button 
              variant="quiet" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0 rtl:rotate-180"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0 space-y-1">
            <AnimatePresence mode="wait">
              <motion.h1
                key={title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="truncate text-[1.05rem] font-semibold tracking-[-0.04em]"
              >
                {title}
              </motion.h1>
            </AnimatePresence>
            {subtitle && (
              <p className="max-w-[32ch] text-[0.76rem] leading-relaxed text-muted-foreground/72">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
