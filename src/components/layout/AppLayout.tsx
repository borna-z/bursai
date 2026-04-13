import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { SeedProgressPill } from './SeedProgressPill';
import { useKeyboardAdjust } from '@/hooks/useKeyboardAdjust';
import { useMedianStatusBar } from '@/hooks/useMedianStatusBar';
import { useViewportShell } from '@/hooks/useViewportShell';
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
  useViewportShell();
  useMedianStatusBar(resolvedTheme);
  useUnlockCelebration();

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={{
        minHeight: 'var(--app-viewport-height, 100svh)',
        height: 'var(--app-viewport-height, 100svh)',
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-md"
        style={{ zIndex: 'var(--z-celebration)' } as React.CSSProperties}
      >
        {t('common.skip_to_main')}
      </a>
      <OfflineBanner />
      <main
        id="main-content"
        className="relative flex-1 overflow-x-clip overflow-y-auto scrollbar-hide"
        style={{
          zIndex: 'var(--z-base)',
          paddingBottom: hideNav ? '0px' : 'var(--app-bottom-clearance)',
          overscrollBehavior: 'none',
        } as React.CSSProperties}
      >
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <SeedProgressPill />
      <MilestoneCelebration />
    </div>
  );
}
