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
      <div className="border border-border/40 overflow-hidden rounded-[1.25rem]">
        {children}
      </div>
    </section>
  );
}
