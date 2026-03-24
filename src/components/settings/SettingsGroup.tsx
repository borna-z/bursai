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
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: 9,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: 'rgba(28,25,23,0.38)',
          marginBottom: 6, marginTop: 16, paddingLeft: 4,
        }}>
          {title}
        </p>
      )}
      <div className="bg-card/60 border border-border/15 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
