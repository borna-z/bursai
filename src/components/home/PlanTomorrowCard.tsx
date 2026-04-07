import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { addDays } from 'date-fns';
import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';

export function PlanTomorrowCard() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const tomorrow = addDays(new Date(), 1);
  const label = formatLocalizedDate(tomorrow, locale, { weekday: 'long' });

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={TAP_TRANSITION}
      onClick={() => { hapticLight(); navigate('/plan', { state: { initialDate: tomorrow.toISOString() } }); }}
      className="w-full flex items-center gap-3.5 rounded-[1.25rem] surface-interactive p-4 text-left will-change-transform"
    >
      <div className="w-10 h-10 rounded-[1.1rem] bg-accent/10 flex items-center justify-center flex-shrink-0">
        <CalendarDays className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground">
          {t('home.plan_tomorrow')}
        </p>
        <p className="text-[12px] text-muted-foreground/60 capitalize">
          {label}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
    </motion.button>
  );
}
