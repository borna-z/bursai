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
          <span className="settings-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-secondary/85 text-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] [&>svg]:h-[16px] [&>svg]:w-[16px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-[15px] font-medium text-foreground">{label}</span>
          {sublabel && <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground/65">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </>
  );

  const baseClass = cn(
    'flex w-full items-center justify-between gap-3 px-4 py-4 text-left',
    !last && 'border-b border-border/35',
    onClick && 'transition-colors hover:bg-background/50 active:bg-background/70',
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
