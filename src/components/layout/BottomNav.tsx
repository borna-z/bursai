import { BarChart3, CalendarDays, Home, Plus, Shirt } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { prefetchRoute } from '@/lib/routePrefetch';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';

function translateOrFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated && translated !== key ? translated : fallback;
}

const tabKeys = [
  { path: '/', labelKey: 'nav.today', fallback: 'Today', icon: Home, emphasis: 'default' as const },
  { path: '/wardrobe', labelKey: 'nav.wardrobe', fallback: 'Wardrobe', icon: Shirt, emphasis: 'default' as const },
  { path: '/ai', labelKey: 'nav.style_me', fallback: 'Style Me', icon: Plus, emphasis: 'primary' as const },
  { path: '/plan', labelKey: 'nav.plan', fallback: 'Plan', icon: CalendarDays, emphasis: 'default' as const },
  { path: '/insights', labelKey: 'nav.insights', fallback: 'Insights', icon: BarChart3, emphasis: 'default' as const },
];

export function BottomNav() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
  const navigate = useNavigate();
  const coach = useFirstRunCoach();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pointer-events-none"
      aria-label="Main navigation"
    >
      <div className="pointer-events-auto mx-auto max-w-xl">
        <div className="mx-auto flex min-h-[72px] w-full items-end justify-evenly rounded-[1.85rem] border border-border/45 bg-background/90 px-1.5 py-1.5 shadow-[0_16px_34px_rgba(28,25,23,0.1)] backdrop-blur-xl backdrop-saturate-[1.35]">
          {tabKeys.map((tab) => {
            const label = translateOrFallback(t, tab.labelKey, tab.fallback);
            const navLink = (
              <NavLink
                to={tab.path}
                end={tab.path === '/'}
                aria-label={label}
                onClick={() => hapticLight()}
                onPointerEnter={() => prefetchRoute(tab.path)}
                onFocus={() => prefetchRoute(tab.path)}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[58px] items-stretch justify-center px-1.5 py-2 text-[10px] font-medium leading-none transition-colors duration-150',
                    tab.emphasis === 'primary' ? 'flex-[1.15]' : 'flex-1',
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  tab.emphasis === 'primary' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center">
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-[0_12px_22px_rgba(28,25,23,0.18)]">
                        {isActive && !prefersReduced ? (
                          <motion.div
                            layoutId="nav-primary-ring"
                            className="absolute inset-[-4px] rounded-full border border-foreground/12"
                            transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.8 }}
                          />
                        ) : null}
                        <tab.icon className="relative z-10 h-6 w-6" strokeWidth={2.6} />
                      </div>
                      <span className="sr-only">{label}</span>
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-center">
                      <div className="relative flex h-10 w-12 items-center justify-center rounded-[1.1rem]">
                        {isActive && (
                          <motion.div
                            layoutId={prefersReduced ? undefined : 'nav-pill'}
                            className="absolute inset-0 rounded-[1.1rem] bg-secondary/82"
                            transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }}
                          />
                        )}
                        <tab.icon
                          className={cn(
                            'relative z-10 h-5 w-5 transition-transform duration-150',
                            isActive && 'scale-[1.04]'
                          )}
                          strokeWidth={isActive ? 2.35 : 2}
                        />
                      </div>
                      <span className="block leading-none tracking-[0.08em]">
                        {label}
                      </span>
                    </div>
                  )
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
