import { WashingMachine, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseISO, isToday, isTomorrow } from 'date-fns';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLaundryCycle } from '@/hooks/useLaundryCycle';
import { motion, AnimatePresence } from 'framer-motion';

export function LaundryAlertBanner() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { alerts } = useLaundryCycle();

  const topAlert = alerts[0];
  const dateLabel = topAlert
    ? (() => {
        const dateObj = parseISO(topAlert.neededDate);
        if (isToday(dateObj)) return t('plan.today');
        if (isTomorrow(dateObj)) return t('plan.tomorrow');
        return formatLocalizedDate(dateObj, locale, { weekday: 'long' });
      })()
    : '';

  return (
    <AnimatePresence>
      {topAlert && (
        <motion.button
          key="laundry-alert-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onClick={() => navigate(`/wardrobe/${topAlert.garment.id}`)}
          className="w-full flex items-center gap-3 surface-utility rounded-[1.25rem] border-warning/20 p-3 press text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
            <WashingMachine className="w-4 h-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {t('laundry.wash_alert_title')}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              <span className="font-medium text-foreground">{topAlert.garment.title}</span>
              {' '}{t('laundry.needed_for')}{' '}{dateLabel}
            </p>
          </div>
          {alerts.length > 1 && (
            <span className="text-[10px] text-warning font-medium whitespace-nowrap">
              +{alerts.length - 1}
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
