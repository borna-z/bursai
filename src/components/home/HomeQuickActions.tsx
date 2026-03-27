import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { HomeQuickAction } from '@/components/home/homeTypes';

interface HomeQuickActionsProps {
  actions: HomeQuickAction[];
}

export function HomeQuickActions({ actions }: HomeQuickActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="px-0.5">
        <p className="label-editorial text-muted-foreground/60">Tool Deck</p>
        <h2 className="mt-1 text-[1.25rem] font-semibold tracking-[-0.03em] text-foreground">
          Move across the wardrobe faster
        </h2>
      </div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={{
          initial: {},
          animate: {
            transition: {
              staggerChildren: 0.06,
            },
          },
        }}
        className="grid grid-cols-2 gap-3"
      >
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <motion.button
              key={action.id}
              variants={{
                initial: { opacity: 0, y: 12 },
                animate: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={action.onClick}
              className={[
                'group relative overflow-hidden rounded-[1.55rem] border border-foreground/[0.08] bg-card p-4 text-left shadow-[0_14px_30px_rgba(22,18,15,0.06)] transition-transform duration-200 hover:-translate-y-0.5',
                action.featured ? 'col-span-2 min-h-[164px]' : 'min-h-[154px]',
              ].join(' ')}
            >
              <div
                className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${action.accentClass} opacity-85`}
                aria-hidden="true"
              />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex size-11 items-center justify-center rounded-[1rem] bg-background/90 text-foreground shadow-sm">
                    <Icon className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-foreground/45 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>

                <div className="mt-auto pt-10">
                  <h3 className="text-[1.05rem] font-semibold tracking-[-0.025em] text-foreground">
                    {action.title}
                  </h3>
                  <p className="mt-1.5 max-w-[28ch] text-[0.92rem] leading-6 text-muted-foreground">
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
