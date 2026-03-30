import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CardPillTone = 'default' | 'muted' | 'accent' | 'strong' | 'warning' | 'warm';
type CardPillSize = 'sm' | 'md';

const TONE_STYLES: Record<CardPillTone, string> = {
  default: 'border-foreground/10 bg-background/80 text-foreground/60',
  muted: 'border-border/12 bg-background/72 text-foreground/55',
  accent: 'border-primary/16 bg-primary/[0.08] text-primary',
  strong: 'border-transparent bg-foreground/88 text-background',
  warning: 'border-amber-200/65 bg-amber-100/92 text-amber-900',
  warm: 'border-foreground/10 bg-card text-foreground/60',
};

const SIZE_STYLES: Record<CardPillSize, string> = {
  sm: 'px-2.5 py-1 text-[10px]',
  md: 'px-3 py-1.5 text-[11px]',
};

export function CardEyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("font-body text-[10px] uppercase tracking-[0.18em] text-foreground/50", className)}>
      {children}
    </p>
  );
}

export function CardMetaRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {children}
    </div>
  );
}

export function CardPill({
  icon: Icon,
  label,
  tone = 'default',
  size = 'sm',
  className,
}: {
  icon?: ElementType<{ className?: string }>;
  label: ReactNode;
  tone?: CardPillTone;
  size?: CardPillSize;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium tracking-[0.08em] backdrop-blur-sm',
        TONE_STYLES[tone],
        SIZE_STYLES[size],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}
