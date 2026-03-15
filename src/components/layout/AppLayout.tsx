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
      <OfflineBanner />
      <main className={`flex-1 overflow-y-auto scrollbar-hide relative ${hideNav ? '' : 'pb-[80px]'}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
    </div>
  );
}
