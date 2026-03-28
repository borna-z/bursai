import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { HomeQuickAction } from '@/components/home/homeTypes';
import { cn } from '@/lib/utils';

interface HomeQuickActionsProps {
  actions: HomeQuickAction[];
}

export function HomeQuickActions({ actions }: HomeQuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="label-editorial text-muted-foreground/60">Quick moves</p>
        <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/55">
          {actions.length} routes
        </p>
      </div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: {},
          animate: {
            transition: {
              staggerChildren: 0.05,
            },
          },
        }}
        className="overflow-hidden rounded-[1.6rem] border border-foreground/[0.08] bg-card shadow-[0_14px_28px_rgba(22,18,15,0.04)]"
      >
        <div className="grid grid-cols-2">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isLastOdd = actions.length % 2 === 1 && index === actions.length - 1;

            return (
              <motion.button
                key={action.id}
                variants={{
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                onClick={action.onClick}
                className={cn(
                  'group flex min-h-[92px] items-center gap-3 border-b border-r border-foreground/[0.08] px-4 py-4 text-left transition-colors hover:bg-background/55',
                  index % 2 === 1 && 'border-r-0',
                  index >= actions.length - 2 && actions.length % 2 === 0 && 'border-b-0',
                  isLastOdd && 'col-span-2 border-r-0 border-b-0'
                )}
              >
                <div className={cn('flex size-11 items-center justify-center rounded-[0.95rem]', action.toneClass)}>
                  <Icon className="size-5 text-foreground/80" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.98rem] font-medium tracking-[-0.02em] text-foreground">
                    {action.title}
                  </p>
                  <p className="mt-1 text-[0.84rem] text-muted-foreground">
                    {action.description}
                  </p>
                </div>

                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/45 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
