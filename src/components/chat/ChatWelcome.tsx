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
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'tween' as const, ease: EASE_CURVE, duration: 0.45 },
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
      className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center"
    >
      <motion.div
        variants={itemVariants}
        className="w-20 h-20 rounded-3xl bg-accent/[0.06] flex items-center justify-center mb-5"
      >
        <Icon className="w-8 h-8 text-accent" />
      </motion.div>
      <motion.p
        variants={itemVariants}
        className="text-base leading-relaxed text-muted-foreground max-w-xs whitespace-pre-wrap"
      >
        {welcomeText}
      </motion.p>
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2 justify-center mt-6 max-w-sm">
        {suggestions.map((s, i) => (
          <motion.button
            key={s}
            variants={itemVariants}
            onClick={() => onSuggestion(s)}
            className="px-4 py-2.5 text-xs rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground transition-colors"
            whileTap={{ scale: 0.96 }}
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
