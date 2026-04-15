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
    // offsetTop reflects the STABLE safe-area base only, NOT
    // visualViewport.offsetTop. Mixing in transient viewport offsets
    // caused --safe-area-top to balloon when the mobile keyboard opened,
    // pushing the chat layout off-screen. In JSDOM safe-area base is 0.
    expect(document.documentElement.style.getPropertyValue('--app-viewport-offset-top')).toBe('0px');
  });

  it('renders an app-level safe-area cover above main', () => {
    const { container } = render(
      <MemoryRouter>
        <AppLayout>
          <div>Shell content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    const cover = container.querySelector('[data-app-safe-area-cover="true"]');
    expect(cover).not.toBeNull();
    // Must be topbar-frost so it visually matches the sticky header below it.
    expect(cover?.className ?? '').toContain('topbar-frost');
  });

  it('pads <main> with the safe-area inset so pages without PageHeader still clear the dynamic island', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div>Shell content</div>
        </AppLayout>
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    // Padding is expressed as both an inline style and a Tailwind arbitrary
    // class because JSDOM strips var() from inline padding-top during its
    // CSS parse. Runtime browsers honor the inline style; the class is the
    // test-visible fallback and also survives prerendering/SSR.
    const style = main.getAttribute('style') ?? '';
    const className = main.className ?? '';
    expect(style + ' ' + className).toContain('var(--safe-area-top)');
  });
});
