import { Home, Shirt, CalendarDays, Bot, Compass } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { EASE_TWEEN, SPRING_BOUNCE } from '@/lib/motion';
import { hapticLight } from '@/lib/haptics';
import { useTrendingUnlocked } from '@/hooks/useTrendingUnlocked';
import { prefetchRoute } from '@/lib/routePrefetch';

const tabKeys = [
  { path: '/', labelKey: 'nav.today', icon: Home },
  { path: '/wardrobe', labelKey: 'nav.wardrobe', icon: Shirt },
  { path: '/plan', labelKey: 'nav.plan', icon: CalendarDays },
  { path: '/ai', labelKey: 'nav.stylist', icon: Bot },
  { path: '/discover', labelKey: 'nav.discover', icon: Compass },
];

export function BottomNav() {
  const { t } = useLanguage();
  const { showNewBadge } = useTrendingUnlocked();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/50 backdrop-blur-xl backdrop-saturate-150 border-t border-border/10 safe-bottom">
      <div className="flex justify-around items-center h-12 max-w-lg mx-auto px-2">
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
                      className="absolute inset-0 bg-accent/10 rounded-2xl will-change-transform"
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
                  {/* NEW badge for Discover when trending unlocks */}
                  {tab.path === '/discover' && showNewBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
                  )}
                </div>
                <span>{t(tab.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
