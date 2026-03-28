import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import type { HomeQuickAction } from '@/components/home/homeTypes';
import { cn } from '@/lib/utils';

interface HomeQuickActionsProps {
  actions: HomeQuickAction[];
}

export function HomeQuickActions({ actions }: HomeQuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
          Quick actions
        </p>
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/50">
          {actions.length} tools
        </p>
      </div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: {},
          animate: {
            transition: {
              staggerChildren: 0.04,
            },
          },
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <motion.button
              key={action.id}
              variants={{
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={action.onClick}
              className="group"
            >
              <div className="flex min-h-[124px] w-full flex-col justify-between rounded-[1.35rem] border border-foreground/[0.08] bg-card px-4 py-4 text-left shadow-[0_12px_24px_rgba(22,18,15,0.04)] transition-transform duration-200 group-active:scale-[0.985]">
                <div className={cn('flex size-11 items-center justify-center rounded-[0.95rem]', action.toneClass)}>
                  <Icon className="size-5 text-foreground/80" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.94rem] font-medium tracking-[-0.02em] text-foreground">
                      {action.title}
                    </p>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-[0.8rem] leading-5 text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </section>
  );
}
