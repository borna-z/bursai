import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TAP_TRANSITION } from '@/lib/motion';

interface SettingsRowProps {
  icon?: ReactNode;
  label: string;
  sublabel?: string;
  children?: ReactNode;
  last?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SettingsRow({ icon, label, sublabel, children, last, onClick, className }: SettingsRowProps) {
  const content = (
    <>
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {icon && (
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/40 flex items-center justify-center [&>svg]:w-[16px] [&>svg]:h-[16px] text-foreground/70">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-[15px] font-medium text-foreground">{label}</span>
          {sublabel && <p className="text-[12px] text-muted-foreground/50 mt-0.5 leading-tight">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </>
  );

  const baseClass = cn(
    'flex items-center justify-between gap-3 px-4 py-3.5 w-full text-left',
    !last && 'border-b border-border/5',
    onClick && 'transition-colors active:bg-muted/30',
    className,
  );

  if (onClick) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        transition={TAP_TRANSITION}
        onClick={onClick}
        className={cn(baseClass, 'will-change-transform')}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <div className={baseClass}>
      {content}
    </div>
  );
}
