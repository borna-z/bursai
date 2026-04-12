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
        {icon && (
          <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center opacity-50 [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <span className="text-[14px] font-['DM_Sans'] text-foreground">{label}</span>
          {sublabel && <p className="mt-0.5 text-[13px] leading-tight text-muted-foreground/65">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </>
  );

  const baseClass = cn(
    'flex w-full items-center justify-between gap-3 px-4 py-[13px] text-left',
    onClick && 'transition-colors hover:bg-background/50 active:bg-background/70',
    className,
  );

  const row = onClick ? (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={TAP_TRANSITION}
      onClick={onClick}
      className={cn(baseClass, 'will-change-transform')}
    >
      {content}
    </motion.button>
  ) : (
    <div className={baseClass}>
      {content}
    </div>
  );

  return (
    <>
      {row}
      {!last && (
        <div className="h-[0.5px] bg-border/30 ml-[46px]" />
      )}
    </>
  );
}
