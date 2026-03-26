import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SeedProgressPill } from './SeedProgressPill';
import { useKeyboardAdjust } from '@/hooks/useKeyboardAdjust';
import { useMedianStatusBar } from '@/hooks/useMedianStatusBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnlockCelebration } from '@/hooks/useWardrobeUnlocks';

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
    <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-md">
        Skip to main content
      </a>
      <OfflineBanner />
      <main id="main-content" className={`relative flex-1 overflow-y-auto scrollbar-hide ${hideNav ? '' : 'pb-[calc(80px+env(safe-area-inset-bottom,0px))]'}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
    </div>
  );
}
