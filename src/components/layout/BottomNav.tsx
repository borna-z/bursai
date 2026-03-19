import { Home, Shirt, CalendarDays, Bot, BarChart3 } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { prefetchRoute } from '@/lib/routePrefetch';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';

const tabKeys = [
  { path: '/', labelKey: 'nav.today', icon: Home },
  { path: '/wardrobe', labelKey: 'nav.wardrobe', icon: Shirt },
  { path: '/plan', labelKey: 'nav.plan', icon: CalendarDays },
  { path: '/ai', labelKey: 'nav.stylist', icon: Bot },
  { path: '/insights', labelKey: 'nav.insights', icon: BarChart3 },
];

export function BottomNav() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();
  const coach = useFirstRunCoach();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/15 bg-background/60 backdrop-blur-2xl backdrop-saturate-[1.8] safe-bottom" aria-label="Main navigation">
      <div className="mx-auto flex min-h-[60px] max-w-lg items-stretch px-2 pb-1 pt-1.5">
        {tabKeys.map((tab) => {
          const navLink = (
            <NavLink
              key={tab.path}
              to={tab.path}
              onClick={() => hapticLight()}
              onPointerEnter={() => prefetchRoute(tab.path)}
              onFocus={() => prefetchRoute(tab.path)}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full min-h-[44px] flex-1 flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium leading-none transition-colors duration-150',
                  isActive
                    ? 'text-accent'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex h-9 w-10 items-center justify-center rounded-2xl">
                    {isActive && (
                      <motion.div
                        layoutId={prefersReduced ? undefined : 'nav-pill'}
                        className="absolute inset-0 bg-accent/10 rounded-2xl"
                        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
                      />
                    )}
                    <tab.icon
                      className={cn(
                        'relative z-10 w-5 h-5 transition-transform duration-150',
                        isActive && 'scale-[1.06]'
                      )}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                  </div>
                  <span className="leading-none">{t(tab.labelKey)}</span>
                </>
              )}
            </NavLink>
          );

          if (tab.path === '/wardrobe') {
            return (
              <CoachMark
                key={tab.path}
                step={0}
                currentStep={coach.currentStep}
                isCoachActive={coach.isStepActive(0)}
                title="Start here"
                body="Add your clothes to BURS. The AI reads each garment automatically."
                ctaLabel="Take me there"
                onCta={() => { navigate('/wardrobe'); coach.advanceStep(); }}
                position="top"
              >
                {navLink}
              </CoachMark>
            );
          }

          return navLink;
        })}
      </div>
    </nav>
  );
}
