import { motion } from 'framer-motion';
import type { TodaySuggestion } from '@/lib/buildTodaySuggestions';

interface HomeAskBursRailProps {
  suggestions: TodaySuggestion[];
  onSelectSuggestion: (suggestion: TodaySuggestion) => void;
}

export function HomeAskBursRail({ suggestions, onSelectSuggestion }: HomeAskBursRailProps) {
  const visibleSuggestions = suggestions.slice(0, 3);

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="label-editorial text-muted-foreground/60">Ask BURS</p>
        <p className="text-[0.74rem] uppercase tracking-[0.18em] text-muted-foreground/55">
          Quick prompts
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
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {visibleSuggestions.map((suggestion) => (
          <motion.button
            key={suggestion.id}
            variants={{
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.24 }}
            onClick={() => onSelectSuggestion(suggestion)}
            className="shrink-0 rounded-full border border-foreground/[0.08] bg-card px-4 py-2.5 text-left text-[0.88rem] leading-6 text-foreground shadow-[0_10px_22px_rgba(22,18,15,0.04)] transition-colors hover:bg-secondary/75"
          >
            {suggestion.text}
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
}
