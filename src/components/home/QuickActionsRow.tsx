import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { addDays } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

export function QuickActionsRow() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  return (
    <div className="flex gap-3">
      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
        whileTap={prefersReduced ? undefined : { scale: 0.97 }}
        onClick={() => {
          hapticLight();
          navigate('/plan', { state: { initialDate: addDays(new Date(), 1).toISOString() } });
        }}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-[var(--radius,1rem)] surface-interactive min-h-[44px]"
      >
        <CalendarDays className="w-4 h-4 text-muted-foreground/60" />
        <span className="text-[0.8125rem] font-semibold text-foreground/80 tracking-[-0.01em]">
          {t('home.plan_tomorrow')}
        </span>
      </motion.button>
    </div>
  );
}
