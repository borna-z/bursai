import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/components/layout/AppLayout';

const useViewportShellMock = vi.fn();

vi.mock('@/components/layout/BottomNav', () => ({
  BottomNav: () => <nav aria-label="Main navigation">nav</nav>,
}));

vi.mock('@/components/layout/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

vi.mock('@/components/layout/SeedProgressPill', () => ({
  SeedProgressPill: () => null,
}));

vi.mock('@/components/layout/MilestoneCelebration', () => ({
  MilestoneCelebration: () => null,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useKeyboardAdjust', () => ({
  useKeyboardAdjust: vi.fn(),
}));

vi.mock('@/hooks/useViewportShell', () => ({
  useViewportShell: () => useViewportShellMock(),
}));

vi.mock('@/hooks/useMedianStatusBar', () => ({
  useMedianStatusBar: vi.fn(),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useUnlockCelebration: vi.fn(),
}));

describe('AppLayout', () => {
  it('uses the measured viewport shell and layout-owned safe-area padding', () => {
    const { container } = render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    const shell = container.querySelector('div[style*="app-viewport-height"]') as HTMLElement | null;
    const shellStyle = shell?.getAttribute('style') ?? '';

    expect(shellStyle).toContain('height: var(--app-viewport-height, 100svh)');
    expect(shellStyle).toContain('min-height: var(--app-viewport-height, 100svh)');
    expect(useViewportShellMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('omits the bottom nav when hideNav is true', () => {
    render(
      <AppLayout hideNav>
        <div>content</div>
      </AppLayout>,
    );

    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  });
});
