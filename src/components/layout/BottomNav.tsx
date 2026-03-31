import { useState } from 'react';
import { BarChart3, CalendarDays, Home, Plus, Shirt } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { prefetchRoute } from '@/lib/routePrefetch';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { BottomNavAddSheet } from './BottomNavAddSheet';

const ROUTE_TABS = [
  { path: '/', labelKey: 'nav.today', icon: Home },
  { path: '/wardrobe', labelKey: 'nav.wardrobe', icon: Shirt },
  { path: '/plan', labelKey: 'nav.plan', icon: CalendarDays },
  { path: '/insights', labelKey: 'nav.insights', icon: BarChart3 },
] as const;

function RouteTab({
  path,
  labelKey,
  icon: Icon,
}: (typeof ROUTE_TABS)[number]) {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();

  return (
    <NavLink
      to={path}
      aria-label={t(labelKey)}
      onClick={() => hapticLight()}
      onPointerEnter={() => prefetchRoute(path)}
      onFocus={() => prefetchRoute(path)}
      className={({ isActive }) =>
        cn('app-dock-tab', isActive && 'app-dock-tab-active')
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.div
              layoutId={prefersReduced ? undefined : 'dock-active-pill'}
              className="absolute inset-0 rounded-[1.25rem] border border-border/70 bg-card shadow-[0_14px_24px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)]"
              transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.8 }}
            />
          ) : null}
          <div className="relative z-10 flex flex-col items-center justify-center gap-[3px]">
            <Icon
              className={cn('h-5 w-5 transition-transform', isActive && 'scale-[1.05]')}
              strokeWidth={isActive ? 2.3 : 2.0}
            />
            <span className={cn(
              'text-[11px] tracking-[0.06em] transition-colors',
              isActive ? 'font-medium text-foreground' : 'text-muted-foreground/60'
            )}>
              {t(labelKey)}
            </span>
          </div>
        </>
      )}
    </NavLink>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const coach = useFirstRunCoach();
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const showWardrobeCoach = coach.isStepActive(0) && location.pathname !== '/wardrobe';

  const wardrobeTab = (
    <div className="app-dock-slot">
      <RouteTab {...ROUTE_TABS[1]} />
    </div>
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 pointer-events-none"
        aria-label={t('nav.main_navigation')}
      >
        <div className="app-dock pointer-events-auto flex items-center gap-1">
          <div className="app-dock-slot">
            <RouteTab {...ROUTE_TABS[0]} />
          </div>

          {showWardrobeCoach ? (
            <CoachMark
              step={0}
              currentStep={coach.currentStep}
              isCoachActive
              title={t('coach.start_here_title')}
              body={t('coach.start_here_body')}
              ctaLabel={t('coach.start_here_cta')}
              onCta={() => {
                navigate('/wardrobe');
                coach.advanceStep();
              }}
              onSkip={() => coach.completeTour()}
              position="top"
            >
              {wardrobeTab}
            </CoachMark>
          ) : (
            wardrobeTab
          )}

          <div className="app-dock-slot">
            <button
              type="button"
              aria-label={t('nav.add')}
              aria-expanded={addSheetOpen}
              aria-haspopup="dialog"
              data-testid="bottom-nav-add"
              onClick={() => {
                hapticLight();
                setAddSheetOpen(true);
              }}
              className={cn(
                'flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full border border-border/70 bg-primary text-primary-foreground shadow-[0_18px_34px_rgba(0,0,0,0.32)] transition-transform active:scale-[0.97]',
                addSheetOpen && 'scale-[1.02]',
              )}
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </button>
          </div>

          <div className="app-dock-slot">
            <RouteTab {...ROUTE_TABS[2]} />
          </div>

          <div className="app-dock-slot">
            <RouteTab {...ROUTE_TABS[3]} />
          </div>
        </div>
      </nav>

      <BottomNavAddSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
    </>
  );
}
