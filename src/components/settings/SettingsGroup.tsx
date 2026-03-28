import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <section className={cn('space-y-2.5', className)}>
      {title && (
        <p className="px-1 text-[0.66rem] font-medium uppercase tracking-[0.22em] text-muted-foreground/48">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-[1.6rem] border border-border/45 bg-card/80 shadow-[0_18px_40px_rgba(22,18,15,0.05)]">
        {children}
      </div>
    </section>
  );
}
