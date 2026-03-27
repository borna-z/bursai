import { motion } from 'framer-motion';
import type { TodaySuggestion } from '@/lib/buildTodaySuggestions';

interface HomeAskBursRailProps {
  suggestions: TodaySuggestion[];
  onSelectSuggestion: (suggestion: TodaySuggestion) => void;
}

export function HomeAskBursRail({ suggestions, onSelectSuggestion }: HomeAskBursRailProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="px-0.5">
        <p className="label-editorial text-muted-foreground/60">Ask BURS</p>
        <h2 className="mt-1 text-[1.1rem] font-semibold tracking-[-0.03em] text-foreground">
          Quick prompts for right now
        </h2>
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
        {suggestions.map((suggestion) => (
          <motion.button
            key={suggestion.id}
            variants={{
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.24 }}
            onClick={() => onSelectSuggestion(suggestion)}
            className="rounded-full border border-foreground/[0.08] bg-card px-4 py-2.5 text-left text-[0.92rem] leading-6 text-foreground shadow-[0_10px_24px_rgba(22,18,15,0.04)] transition-colors hover:bg-secondary/70"
          >
            {suggestion.text}
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
}
