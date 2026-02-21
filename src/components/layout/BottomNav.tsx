import { Home, Shirt, CalendarDays, Bot, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {tabKeys.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
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
                      className="absolute inset-0 bg-accent/10 rounded-2xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                    />
                  )}
                  <tab.icon
                    className={cn('relative z-10 w-5 h-5 transition-transform duration-200', isActive && 'scale-105')}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
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