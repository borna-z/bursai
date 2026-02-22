import { Home, Shirt, CalendarDays, Bot, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_TWEEN, SPRING_BOUNCE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';

const tabKeys = [
  { path: '/', labelKey: 'nav.today', icon: Home },
  { path: '/wardrobe', labelKey: 'nav.wardrobe', icon: Shirt },
  { path: '/plan', labelKey: 'nav.plan', icon: CalendarDays },
  { path: '/ai', labelKey: 'nav.stylist', icon: Bot },
  { path: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl backdrop-saturate-150 shadow-[0_-1px_0_0_hsl(var(--border)/0.4)] safe-bottom">
      <div className="flex justify-around items-center h-[72px] max-w-lg mx-auto px-2">
        {tabKeys.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            onClick={() => hapticLight()}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors duration-200',
                isActive
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center w-10 h-7 rounded-2xl">
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-accent/10 backdrop-blur-sm rounded-2xl will-change-transform"
                      transition={EASE_TWEEN}
                    />
                  )}
                  <motion.div
                    animate={isActive ? { scale: 1.08 } : { scale: 1 }}
                    transition={SPRING_BOUNCE}
                    className="relative z-10"
                  >
                    <tab.icon
                      className="w-5 h-5"
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </motion.div>
                </div>
                <span>{t(tab.labelKey)}</span>
                {/* Active dot indicator */}
                <div className="h-1 flex items-center justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="nav-dot"
                      className="w-[3px] h-[3px] rounded-full bg-accent"
                      transition={EASE_TWEEN}
                    />
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
