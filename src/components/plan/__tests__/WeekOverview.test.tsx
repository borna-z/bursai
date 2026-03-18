import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/dateLocale', () => ({
  getDateFnsLocale: vi.fn(() => undefined),
}));

vi.mock('@/lib/motion', () => ({
  EASE_CURVE: [0.25, 0.1, 0.25, 1],
  STAGGER_DELAY: 0,
}));

vi.mock('@/lib/haptics', () => ({
  hapticLight: vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, ...rest } = p;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, ...rest } = p;
      return <button {...rest}>{children}</button>;
    },
  },
  useReducedMotion: () => false,
}));

import { WeekOverview } from '../WeekOverview';
import { format, addDays } from 'date-fns';

const today = new Date();

function renderWeek(overrides: Partial<Parameters<typeof WeekOverview>[0]> = {}) {
  const defaults: Parameters<typeof WeekOverview>[0] = {
    selectedDate: today,
    onSelectDate: vi.fn(),
    plannedOutfits: [],
    ...overrides,
  };
  return render(<WeekOverview {...defaults} />);
}

describe('WeekOverview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    const { container } = renderWeek();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 7 day pills', () => {
    const { container } = renderWeek();
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(7);
  });

  it("today's pill has distinct styling", () => {
    const { container } = renderWeek();
    const todayNum = format(today, 'd');
    const buttons = container.querySelectorAll('button');
    const todayButton = Array.from(buttons).find(btn =>
      btn.textContent?.includes(todayNum)
    );
    expect(todayButton).toBeDefined();
    // Today should have bg-foreground or border styling
    expect(
      todayButton!.className.includes('bg-foreground') ||
      todayButton!.className.includes('border')
    ).toBe(true);
  });

  it('calls onSelectDate when a day is clicked', () => {
    const onSelectDate = vi.fn();
    const { container } = renderWeek({ onSelectDate });
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[2]);
    expect(onSelectDate).toHaveBeenCalledOnce();
  });

  it('renders outfit dot indicator for days that have planned outfits', () => {
    const dateStr = format(addDays(today, 1), 'yyyy-MM-dd');
    const plannedOutfits = [
      {
        id: 'po1',
        user_id: 'u1',
        date: dateStr,
        outfit_id: 'o1',
        status: 'planned' as const,
        note: null,
        created_at: new Date().toISOString(),
        outfit: null,
      },
    ];
    const { container } = renderWeek({ plannedOutfits });
    // The dot is a small rounded-full div inside the button
    const dots = container.querySelectorAll('button .rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });
});
