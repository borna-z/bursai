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
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && <span className="flex-shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px] text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </>
  );

  const baseClass = cn(
    'flex items-center justify-between gap-3 px-4 py-4 w-full text-left',
    onClick && 'transition-colors',
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
