import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SeedProgressPill } from './SeedProgressPill';
import { useKeyboardAdjust } from '@/hooks/useKeyboardAdjust';
import { useMedianStatusBar } from '@/hooks/useMedianStatusBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnlockCelebration } from '@/hooks/useWardrobeUnlocks';
import { MilestoneCelebration } from './MilestoneCelebration';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  const { resolvedTheme } = useTheme();
  useKeyboardAdjust();
  useMedianStatusBar(resolvedTheme);
  useUnlockCelebration();

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(154,137,113,0.09),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_72%)]"
      />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-md">
        Skip to main content
      </a>
      <OfflineBanner />
      <main
        id="main-content"
        className="relative z-[1] flex-1 overflow-x-clip overflow-y-auto scrollbar-hide"
        style={{ ...(hideNav ? undefined : { paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }), overscrollBehavior: 'none' }}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
      <MilestoneCelebration />
    </div>
  );
}
