import { useNavigate } from 'react-router-dom';
import { Plus, Layers, Bot, CalendarDays } from 'lucide-react';
import { motion } from 'framer-motion';
import { TAP_TRANSITION } from '@/lib/motion';
import { useLanguage } from '@/contexts/LanguageContext';

const ACTIONS = [
  { key: 'home.quick_add', icon: Plus, path: '/wardrobe/add' },
  { key: 'home.quick_build', icon: Layers, path: '/outfits/generate' },
  { key: 'home.quick_ai', icon: Bot, path: '/ai' },
  { key: 'home.quick_plan', icon: CalendarDays, path: '/plan' },
] as const;

export function QuickActionsGrid() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-4 gap-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.key}
            whileTap={{ scale: 0.95 }}
            transition={TAP_TRANSITION}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-card border border-border/20 will-change-transform"
          >
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
              <Icon className="w-[18px] h-[18px] text-foreground/80" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {t(action.key)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
