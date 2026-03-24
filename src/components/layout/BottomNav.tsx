import { Home, Shirt, CalendarDays, Sparkles } from 'lucide-react';
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
  { path: '/ai', labelKey: 'Style Me', icon: Sparkles },
  { path: '/plan', labelKey: 'nav.plan', icon: CalendarDays },
];

export function BottomNav() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();
  const coach = useFirstRunCoach();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/15 bg-background/60 backdrop-blur-2xl backdrop-saturate-[1.8]"
      aria-label="Main navigation"
    >
      <div className="mx-auto max-w-lg px-2">
        <div className="flex h-[60px] w-full items-stretch justify-evenly">
          {tabKeys.map((tab) => {
            const navLink = (
              <NavLink
                to={tab.path}
                onClick={() => hapticLight()}
                onPointerEnter={() => prefetchRoute(tab.path)}
                onFocus={() => prefetchRoute(tab.path)}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[44px] flex-1 items-stretch justify-center px-2 py-2 text-[10px] font-medium leading-none transition-colors duration-150',
                    isActive
                      ? 'text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
                    <div className="relative flex h-9 w-10 items-center justify-center rounded-2xl">
                      {isActive && (
                        <motion.div
                          layoutId={prefersReduced ? undefined : 'nav-pill'}
                          className="absolute inset-0 rounded-2xl bg-accent/10"
                          transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
                        />
                      )}
                      <tab.icon
                        className={cn(
                          'relative z-10 h-5 w-5 transition-transform duration-150',
                          isActive && 'scale-[1.06]'
                        )}
                        strokeWidth={isActive ? 2.4 : 2}
                      />
                    </div>
                    <span className="block leading-none">{t(tab.labelKey)}</span>
                  </div>
                )}
              </NavLink>
            );

            return (
              <div key={tab.path} className="flex flex-1 justify-center">
                {tab.path === '/wardrobe' ? (
                  <CoachMark
                    step={0}
                    currentStep={coach.currentStep}
                    isCoachActive={coach.isStepActive(0)}
                    title="Start here"
                    body="Add your clothes to BURS. The AI reads each garment automatically."
                    ctaLabel="Take me there"
                    onCta={() => {
                      navigate('/wardrobe');
                      coach.advanceStep();
                    }}
                    onSkip={() => coach.completeTour()}
                    position="top"
                  >
                    {navLink}
                  </CoachMark>
                ) : (
                  navLink
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="safe-bottom pointer-events-none" aria-hidden="true" />
    </nav>
  );
}
