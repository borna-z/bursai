import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 w-full text-left',
        !last && 'border-b border-border/50',
        onClick && 'active:bg-muted/60 transition-colors',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && <span className="text-muted-foreground flex-shrink-0 [&>svg]:w-[18px] [&>svg]:h-[18px]">{icon}</span>}
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
        </div>
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </Comp>
  );
}
