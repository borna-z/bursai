import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SeedProgressPill } from './SeedProgressPill';
import { useKeyboardAdjust } from '@/hooks/useKeyboardAdjust';
import { useMedianStatusBar } from '@/hooks/useMedianStatusBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnlockCelebration } from '@/hooks/useWardrobeUnlocks';
import { MilestoneCelebration } from './MilestoneCelebration';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  useKeyboardAdjust();
  useMedianStatusBar(resolvedTheme);
  useUnlockCelebration();

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-[radial-gradient(circle_at_top_right,rgba(177,141,94,0.18),transparent_38%),radial-gradient(circle_at_top_left,rgba(112,102,93,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_78%)]"
      />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-md">
        {t('common.skip_to_main')}
      </a>
      <OfflineBanner />
      <main
        id="main-content"
        className="relative z-[1] flex-1 overflow-x-clip overflow-y-auto scrollbar-hide"
        style={{ ...(hideNav ? undefined : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }), overscrollBehavior: 'none' }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
      <MilestoneCelebration />
    </div>
  );
}
