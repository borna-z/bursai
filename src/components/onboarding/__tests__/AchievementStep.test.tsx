import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AchievementStep } from '@/components/onboarding/AchievementStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
// Keeps the test independent of the live en.ts dict shape — same pattern as
// PhotoTutorialStep.test.tsx.
function humanizedLastSegment(key: string): string {
  const segment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  const humanized = segment.replace(/[_-]/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => humanizedLastSegment(key),
  }),
}));

describe('AchievementStep', () => {
  it('renders the celebratory title and gift body', () => {
    render(<AchievementStep onComplete={vi.fn()} />);

    expect(screen.getByText(/Your studio is ready\./i)).toBeInTheDocument();
    expect(screen.getByText(/Three studio renders, on us/i)).toBeInTheDocument();
    expect(screen.getByText(/three favourite pieces/i)).toBeInTheDocument();
  });

  it('calls onComplete when the primary CTA is pressed', () => {
    const onComplete = vi.fn();
    render(<AchievementStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /Choose my 3 pieces/i });
    fireEvent.click(cta);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
