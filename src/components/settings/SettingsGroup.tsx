import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <div className={cn('mb-6', className)}>
      {title && (
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 mb-1.5 dark:text-white/40">
          {title}
        </h3>
      )}
      <div className="bg-card/70 backdrop-blur-md border border-border/30 rounded-xl overflow-hidden dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.08]">
        {children}
      </div>
    </div>
  );
}
