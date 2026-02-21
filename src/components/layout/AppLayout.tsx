import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background dark:bg-[#030305] flex flex-col">
      <OfflineBanner />
      <main className={`flex-1 overflow-y-auto scrollbar-hide ${hideNav ? '' : 'pb-20'}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
