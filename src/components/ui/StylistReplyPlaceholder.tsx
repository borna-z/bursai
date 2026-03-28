import { motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface StylistReplyPlaceholderProps {
  className?: string;
}

/**
 * Premium placeholder for stylist AI response.
 * Shows shimmer content lines instead of bouncing dots.
 */
export function StylistReplyPlaceholder({ className }: StylistReplyPlaceholderProps) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  const lines = [
    { width: '80%', delay: 0 },
    { width: '60%', delay: 0.1 },
    { width: '45%', delay: 0.2 },
  ];

  return (
    <div className={cn('space-y-3 py-3 px-1', className)}>
      {/* Shimmer content lines */}
      <div className="space-y-2.5">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={prefersReduced ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: line.delay, duration: 0.3 }}
            className="relative h-3 rounded-full overflow-hidden bg-muted/60"
            style={{ width: line.width }}
          >
            {!prefersReduced && (
              <motion.div
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-muted-foreground/10 to-transparent"
                animate={{ x: ['-100%', '400%'] }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.3,
                }}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Quiet label */}
      <motion.p
        initial={prefersReduced ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-[11px] text-muted-foreground/50"
      >
        {t('ai.preparing_note')}
      </motion.p>
    </div>
  );
}
