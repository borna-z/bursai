import { useNavigate } from 'react-router-dom';
import { CalendarDays, Sparkles } from 'lucide-react';
import { addDays } from 'date-fns';
import { motion } from 'framer-motion';
import { hapticLight } from '@/lib/haptics';
import { useLanguage } from '@/contexts/LanguageContext';

const actions: { key: string; icon: typeof CalendarDays; path: string; tomorrow?: boolean }[] = [
  { key: 'plan_tomorrow', icon: CalendarDays, path: '/plan', tomorrow: true },
  { key: 'what_to_wear', icon: Sparkles, path: '/outfits/generate' },
];

export function QuickActionsRow() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="flex gap-3">
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
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl surface-interactive min-h-[44px]"
        >
          <action.icon className="w-4 h-4 text-muted-foreground/60" />
          <span className="text-[0.8125rem] font-semibold text-foreground/80 tracking-[-0.01em]">
            {t(`home.${action.key}`)}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
