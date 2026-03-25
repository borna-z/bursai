import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/lib/motion', () => ({
  EASE_CURVE: [0.25, 0.1, 0.25, 1],
  STAGGER_DELAY: 0.04,
}));

vi.mock('@/components/ui/AILoadingCard', () => ({
  AILoadingCard: ({ subtitle }: { subtitle?: string }) => (
    <div data-testid="ai-loading-card">{subtitle}</div>
  ),
}));

import { OutfitGenerationState } from '../OutfitGenerationState';

describe('OutfitGenerationState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing', () => {
    render(<OutfitGenerationState />);
    expect(screen.getByTestId('ai-loading-card')).toBeInTheDocument();
  });

  it('renders 4 skeleton slots when variant is full', () => {
    const { container } = render(<OutfitGenerationState variant="full" />);
    const skeletons = container.querySelectorAll('[class*="aspect-"]');
    expect(skeletons).toHaveLength(4);
  });

  it('contains work text when occasion prop is work', () => {
    render(<OutfitGenerationState subtitle="Outfit for work" />);
    expect(screen.getByText(/work/i)).toBeInTheDocument();
  });

  it('contains temperature when weatherTemp is 12', () => {
    render(<OutfitGenerationState subtitle="Weather is 12 degrees" />);
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('renders without crashing when no props are passed', () => {
    const { container } = render(<OutfitGenerationState />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
