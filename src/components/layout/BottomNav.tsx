import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/lib/haptics';
import { prefetchRoute } from '@/lib/routePrefetch';
import { CoachMark } from '@/components/coach/CoachMark';
import { useFirstRunCoach } from '@/hooks/useFirstRunCoach';
import { BottomNavAddSheet } from './BottomNavAddSheet';

// ---------------------------------------------------------------------------
// Inline SVG icon components — iOS-native style (1.5px stroke, round caps/joins)
// ---------------------------------------------------------------------------

function HomeIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 22V12h6v10"
          stroke="hsl(var(--background))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 22V12h6v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WardrobeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4" y="4" width="16" height="5" rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? 'currentColor' : 'none'}
      />
      <rect
        x="4" y="10.5" width="16" height="5" rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? 'currentColor' : 'none'}
      />
      <rect
        x="4" y="17" width="16" height="5" rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill={active ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

function PlanIcon({ active }: { active: boolean }) {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3" y="4" width="18" height="18" rx="2.5"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M16 2v4M8 2v4M3 10h18"
          stroke="hsl(var(--background))"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"
          stroke="hsl(var(--background))"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3" y="4" width="18" height="18" rx="2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 2v4M8 2v4M3 10h18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InsightsIcon({ active }: { active: boolean }) {
  const sw = active ? '2' : '1.5';
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 21H4a1 1 0 01-1-1V3"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 17l4-5 4 3 5-7"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Route tab config
// ---------------------------------------------------------------------------

const ROUTE_TABS = [
  { path: '/', label: 'today' },
  { path: '/wardrobe', label: 'wardrobe' },
  // (+) button rendered separately between index 1 and 2
  { path: '/plan', label: 'plan' },
  { path: '/insights', label: 'insights' },
] as const;

type RouteTab = (typeof ROUTE_TABS)[number];

function getIcon(label: RouteTab['label'], active: boolean) {
  switch (label) {
    case 'today':
      return <HomeIcon active={active} />;
    case 'wardrobe':
      return <WardrobeIcon active={active} />;
    case 'plan':
      return <PlanIcon active={active} />;
    case 'insights':
      return <InsightsIcon active={active} />;
  }
}

// ---------------------------------------------------------------------------
// NavTab component
// ---------------------------------------------------------------------------

function NavTab({
  tab,
  isActive,
  onNavigate,
}: {
  tab: RouteTab;
  isActive: boolean;
  onNavigate: (path: string) => void;
}) {
  const { t } = useLanguage();

  return (
    <motion.button
      type="button"
      className="flex-1 flex flex-col items-center gap-[1px] pt-1"
      style={{
        opacity: isActive ? 1 : 0.42,
        fontWeight: isActive ? 500 : 400,
        color: 'hsl(var(--foreground))',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        hapticLight();
        onNavigate(tab.path);
      }}
      onPointerEnter={() => prefetchRoute(tab.path)}
      onFocus={() => prefetchRoute(tab.path)}
      aria-label={t(`nav.${tab.label}`)}
      aria-current={isActive ? 'page' : undefined}
    >
      {getIcon(tab.label, isActive)}
      <span
        style={{
          fontSize: '10px',
          fontFamily: "-apple-system, 'SF Pro Text', 'DM Sans', sans-serif",
          letterSpacing: '-0.1px',
          lineHeight: 1.2,
        }}
      >
        {t(`nav.${tab.label}`)}
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// BottomNav — main export
// ---------------------------------------------------------------------------

export function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const coach = useFirstRunCoach();
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const showWardrobeCoach = coach.isStepActive(0) && location.pathname !== '/wardrobe';

  function isActive(path: string) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  const wardrobeTab = (
    <NavTab
      tab={ROUTE_TABS[1]}
      isActive={isActive(ROUTE_TABS[1].path)}
      onNavigate={(p) => navigate(p)}
    />
  );

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50"
        aria-label={t('nav.main_navigation')}
        style={{
          background: 'hsl(var(--background) / 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '0.5px solid hsl(var(--border) / 0.3)',
          padding: '6px 24px calc(6px + env(safe-area-inset-bottom, 16px))',
        }}
      >
        <div className="flex items-center">
          {/* Home */}
          <NavTab
            tab={ROUTE_TABS[0]}
            isActive={isActive(ROUTE_TABS[0].path)}
            onNavigate={(p) => navigate(p)}
          />

          {/* Wardrobe — wrapped with CoachMark when active */}
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

          {/* Center (+) button */}
          <div className="flex-1 flex justify-center items-center pt-1">
            <motion.button
              type="button"
              aria-label={t('nav.add')}
              aria-expanded={addSheetOpen}
              aria-haspopup="dialog"
              data-testid="bottom-nav-add"
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                hapticLight();
                setAddSheetOpen(true);
              }}
              style={{
                width: 44,
                height: 36,
                borderRadius: 12,
                background: 'linear-gradient(180deg, hsl(var(--accent)), hsl(var(--accent) / 0.8))',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </motion.button>
          </div>

          {/* Plan */}
          <NavTab
            tab={ROUTE_TABS[2]}
            isActive={isActive(ROUTE_TABS[2].path)}
            onNavigate={(p) => navigate(p)}
          />

          {/* Insights */}
          <NavTab
            tab={ROUTE_TABS[3]}
            isActive={isActive(ROUTE_TABS[3].path)}
            onNavigate={(p) => navigate(p)}
          />
        </div>
      </nav>

      <BottomNavAddSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} />
    </>
  );
}
