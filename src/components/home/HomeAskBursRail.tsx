import { motion } from 'framer-motion';

import type { TodaySuggestion } from '@/lib/buildTodaySuggestions';
import { useLanguage } from '@/contexts/LanguageContext';

interface HomeAskBursRailProps {
  suggestions: TodaySuggestion[];
  onSelectSuggestion: (suggestion: TodaySuggestion) => void;
}

export function HomeAskBursRail({ suggestions, onSelectSuggestion }: HomeAskBursRailProps) {
  const { t } = useLanguage();
  const visibleSuggestions = suggestions.slice(0, 2);

  if (visibleSuggestions.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/65">
          {t('home.ask_burs_label')}
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
        className="grid gap-2 sm:grid-cols-2"
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
            className="surface-interactive rounded-[1.25rem] px-4 py-3 text-left text-[13px] leading-5 text-foreground transition-colors hover:bg-secondary/75 min-h-[44px]"
          >
            {suggestion.text}
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
}
