import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/components/layout/AppLayout';

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

vi.mock('@/hooks/useMedianStatusBar', () => ({
  useMedianStatusBar: vi.fn(),
}));

vi.mock('@/hooks/useWardrobeUnlocks', () => ({
  useUnlockCelebration: vi.fn(),
}));

describe('AppLayout', () => {
  it('uses the safe-area-adjusted viewport height without extra main padding', () => {
    const { container } = render(
      <AppLayout>
        <div>content</div>
      </AppLayout>,
    );

    const main = container.querySelector('main');
    const shell = container.querySelector('div[style*="100dvh"]') as HTMLElement | null;
    const shellStyle = shell?.getAttribute('style') ?? '';

    expect(shellStyle).toContain('height: calc(100dvh - env(safe-area-inset-top, 0px))');
    expect(shellStyle).toContain('min-height: calc(100dvh - env(safe-area-inset-top, 0px))');
    expect(main?.style.paddingBottom).toBe('');
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
