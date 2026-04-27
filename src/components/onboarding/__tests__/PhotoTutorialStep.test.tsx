import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PhotoTutorialStep } from '@/components/onboarding/PhotoTutorialStep';

// Mirror LanguageContext's no-provider safety net (humanized last segment of
// the key) so safeT() falls back to the component's explicit English strings.
// Keeps the test independent of the live en.ts dict shape.
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

describe('PhotoTutorialStep', () => {
  it('renders all five photo-tip bullet points', () => {
    render(<PhotoTutorialStep onComplete={vi.fn()} />);

    expect(screen.getByText(/Bright, even light/i)).toBeInTheDocument();
    expect(screen.getByText(/Plain background/i)).toBeInTheDocument();
    expect(screen.getByText(/Whole garment in frame/i)).toBeInTheDocument();
    expect(screen.getByText(/No people in the shot/i)).toBeInTheDocument();
    expect(screen.getByText(/One garment per photo/i)).toBeInTheDocument();
  });

  it('calls onComplete when the "I\'m ready" button is pressed', () => {
    const onComplete = vi.fn();
    render(<PhotoTutorialStep onComplete={onComplete} />);

    const cta = screen.getByRole('button', { name: /I.?m ready/i });
    fireEvent.click(cta);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
