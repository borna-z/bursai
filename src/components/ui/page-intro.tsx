import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageIntroProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  center?: boolean;
}

export function PageIntro({
  title,
  description,
  eyebrow,
  meta,
  actions,
  className,
  titleClassName,
  descriptionClassName,
  center = false,
}: PageIntroProps) {
  return (
    <section
      className={cn(
        'page-intro-block',
        center && 'items-center text-center',
        className,
      )}
    >
      {eyebrow ? (
        <div className={cn('flex flex-wrap gap-2', center && 'justify-center')}>
          {typeof eyebrow === 'string' ? <span className="eyebrow-chip">{eyebrow}</span> : eyebrow}
          {meta}
        </div>
      ) : meta ? (
        <div className={cn('flex flex-wrap gap-2', center && 'justify-center')}>{meta}</div>
      ) : null}

      <div className="space-y-3">
        <h1 className={cn('page-intro-title', titleClassName)}>{title}</h1>
        {description ? (
          <p className={cn('page-intro-copy', descriptionClassName)}>{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className={cn('flex flex-wrap gap-2.5', center && 'justify-center')}>{actions}</div>
      ) : null}
    </section>
  );
}
