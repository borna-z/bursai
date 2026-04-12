import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '../AppLayout';

vi.mock('../BottomNav', () => ({
  BottomNav: () => <nav aria-label="Main navigation">Main nav</nav>,
}));

vi.mock('../OfflineBanner', () => ({
  OfflineBanner: () => <div>Offline banner</div>,
}));

vi.mock('../SeedProgressPill', () => ({
  SeedProgressPill: () => <div>Seed progress</div>,
}));

vi.mock('../MilestoneCelebration', () => ({
  MilestoneCelebration: () => <div>Milestone celebration</div>,
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

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (_key: string) => 'Skip to main content' }),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: {
        height: 720,
        offsetTop: 18,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('uses measured viewport height and shell paddings', () => {
    const { container } = render(
      <MemoryRouter>
        <AppLayout>
          <div>Shell content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    const shell = container.firstElementChild as HTMLElement;
    const shellStyle = shell.getAttribute('style') ?? '';
    expect(shellStyle).toContain('min-height: var(--app-viewport-height, 100svh)');
    expect(shellStyle).toContain('height: var(--app-viewport-height, 100svh)');

    screen.getByRole('main');
    expect(document.documentElement.style.getPropertyValue('--app-viewport-height')).toBe('720px');
    // offsetTop is derived from env(safe-area-inset-top) + iOS fallback (not visualViewport.offsetTop)
    // In JSDOM env() returns 0 and no iOS user-agent is set, so the value is '0px'
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('0px');
  });
});
