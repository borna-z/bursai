import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('@/lib/motion', () => ({
  EASE_CURVE: [0.25, 0.1, 0.25, 1],
}));

import { TodayOutfitHero } from '../TodayOutfitHero';

function renderHero(props: Parameters<typeof TodayOutfitHero>[0] = {}) {
  return render(
    <MemoryRouter>
      <TodayOutfitHero {...props} />
    </MemoryRouter>,
  );
}

describe('TodayOutfitHero', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    renderHero();
    expect(document.querySelector('.bg-foreground')).toBeInTheDocument();
  });

  it('has a headline present in the output', () => {
    renderHero();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toBeTruthy();
  });

  it('mentions rain or weather when precipitation is rain', () => {
    renderHero({ weather: { precipitation: 'rain' } });
    const matches = screen.getAllByText(/rain/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders a clickable CTA button', () => {
    renderHero();
    const button = screen.getByRole('button', { name: 'Style outfit' });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/ai/generate');
  });

  it('contains morning greeting when hour < 10', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T08:00:00'));
    renderHero();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent?.toLowerCase()).toContain('morning');
    vi.useRealTimers();
  });

  it('contains tomorrow or tonight when hour >= 18', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T19:00:00'));
    renderHero();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent?.toLowerCase()).toContain('tomorrow');
    vi.useRealTimers();
  });
});
