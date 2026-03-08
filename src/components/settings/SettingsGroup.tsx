import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <div className={cn('space-y-0', className)}>
      {title && (
        <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest px-1 mb-3">
          {title}
        </p>
      )}
      <div className="rounded-2xl bg-card/50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
