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
        <h3 className="text-[11px] font-medium text-muted-foreground/70 tracking-wide px-4 mb-1.5">
          {title}
        </h3>
      )}
      <div>
        {children}
      </div>
    </div>
  );
}
