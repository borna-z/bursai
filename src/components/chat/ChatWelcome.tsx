import { Sparkles, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatWelcomeProps {
  mode: 'stylist' | 'shopping';
  onSuggestion: (text: string) => void;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: 0.5 },
  },
};

export function ChatWelcome({ mode, onSuggestion }: ChatWelcomeProps) {
  const { t } = useLanguage();
  const Icon = mode === 'shopping' ? ShoppingBag : Sparkles;
  const welcomeText = mode === 'shopping' ? t('chat.shopping_welcome') : t('chat.welcome');
  const suggestions = [t('chat.suggestion_1'), t('chat.suggestion_2'), t('chat.suggestion_3')];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <motion.div
        variants={itemVariants}
        className="w-24 h-24 rounded-[28px] bg-accent/[0.05] flex items-center justify-center mb-8"
      >
        <Icon className="w-9 h-9 text-accent/80" />
      </motion.div>
      <motion.p
        variants={itemVariants}
        className="text-lg leading-relaxed text-muted-foreground font-light max-w-xs whitespace-pre-wrap"
      >
        {welcomeText}
      </motion.p>
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2.5 justify-center mt-8 max-w-sm">
        {suggestions.map((s) => (
          <motion.button
            key={s}
            variants={itemVariants}
            onClick={() => onSuggestion(s)}
            className="px-5 py-3 text-[13px] rounded-2xl border border-border/30 bg-foreground/[0.02] hover:bg-foreground/[0.06] text-foreground transition-colors"
            whileTap={{ scale: 0.96 }}
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
