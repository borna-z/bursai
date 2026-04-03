import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SettingsGroup({ title, children, className }: SettingsGroupProps) {
  return (
    <section className={cn('space-y-2', className)}>
      {title && (
        <p className="label-editorial px-0.5 text-foreground/58">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-[1.35rem] border border-border/28 bg-background/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {children}
      </div>
    </section>
  );
}
