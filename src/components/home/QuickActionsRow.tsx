import { useNavigate } from 'react-router-dom';
import { CalendarDays, Sparkles, Shirt } from 'lucide-react';
import { addDays } from 'date-fns';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

const actions: { key: string; icon: typeof CalendarDays; path: string; tomorrow?: boolean }[] = [
  { key: 'plan_today', icon: CalendarDays, path: '/plan' },
  { key: 'plan_tomorrow', icon: CalendarDays, path: '/plan', tomorrow: true },
  { key: 'what_to_wear', icon: Sparkles, path: '/generate' },
];

export function QuickActionsRow() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex gap-2">
      {actions.map((action, i) => (
        <motion.button
          key={action.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.35 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            hapticLight();
            if (action.tomorrow) {
              navigate(action.path, { state: { initialDate: addDays(new Date(), 1).toISOString() } });
            } else {
              navigate(action.path);
            }
          }}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.07] border border-border/20 transition-colors"
        >
          <action.icon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-foreground/80">
            {t(`home.${action.key}`)}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
