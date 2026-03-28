import { motion } from 'framer-motion';

import type { TodaySuggestion } from '@/lib/buildTodaySuggestions';

interface HomeAskBursRailProps {
  suggestions: TodaySuggestion[];
  onSelectSuggestion: (suggestion: TodaySuggestion) => void;
}

export function HomeAskBursRail({ suggestions, onSelectSuggestion }: HomeAskBursRailProps) {
  const visibleSuggestions = suggestions.slice(0, 3);

  if (visibleSuggestions.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
          Ask BURS
        </p>
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/50">
          Tap to start
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
        className="flex flex-wrap gap-2"
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
            className="rounded-full border border-foreground/[0.08] bg-background/86 px-4 py-2.5 text-left text-[0.84rem] leading-5 text-foreground shadow-[0_10px_18px_rgba(22,18,15,0.03)] transition-colors hover:bg-secondary/75"
          >
            {suggestion.text}
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
}
