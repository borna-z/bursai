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
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span className="settings-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-border/28 bg-secondary/55 text-foreground/68 [&>svg]:h-[15px] [&>svg]:w-[15px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-[14px] font-medium text-foreground">{label}</span>
          {sublabel && <p className="mt-0.5 text-[12px] leading-[1.35] text-muted-foreground/62">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </>
  );

  const baseClass = cn(
    'flex min-h-[58px] w-full items-center justify-between gap-3 px-4.5 py-3.5 text-left',
    !last && 'border-b border-border/22',
    onClick && 'transition-colors hover:bg-background/35 active:bg-background/55',
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
