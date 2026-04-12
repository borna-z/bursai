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
        <p className="label-editorial px-1">
          {title}
        </p>
      )}
      <div className="mx-[var(--page-px)] rounded-[14px] bg-card/30 border-[0.5px] border-border/40 overflow-hidden">
        {children}
      </div>
    </section>
  );
}
