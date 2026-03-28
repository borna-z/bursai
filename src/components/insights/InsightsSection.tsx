import type { ReactNode } from 'react';

import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface InsightsSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InsightsSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: InsightsSectionProps) {
  return (
    <motion.section
      id={id}
      data-testid={`insights-section-${id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={cn('scroll-mt-[9.25rem] space-y-3.5 border-t border-border/35 pt-5 sm:scroll-mt-24 sm:space-y-4 sm:pt-6', className)}
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="space-y-1.5">
          <p className="label-editorial">{eyebrow}</p>
          <div className="space-y-1">
            <h2 className="text-[1.3rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.45rem]">
              {title}
            </h2>
            {description ? (
              <p className="max-w-[34rem] text-[0.88rem] leading-5 text-muted-foreground sm:text-[0.92rem] sm:leading-6">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </motion.section>
  );
}
