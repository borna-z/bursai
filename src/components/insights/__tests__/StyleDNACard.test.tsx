import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseStyleDNA = vi.fn();

vi.mock('@/hooks/useStyleDNA', () => ({
  useStyleDNA: () => mockUseStyleDNA(),
}));

import { StyleDNACard } from '../StyleDNACard';
import type { StyleDNA } from '@/hooks/useStyleDNA';

const baseDNA: StyleDNA = {
  signatureColors: [
    { color: 'Black', percentage: 40 },
    { color: 'Navy', percentage: 30 },
    { color: 'White', percentage: 20 },
  ],
  formalityCenter: 2.5,
  formalitySpread: 'narrow',
  uniformCombos: [
    { combo: ['t-shirt', 'jeans', 'sneakers'], count: 8 },
  ],
  patterns: [
    { label: 'Monochrome tendency', strength: 72, detail: 'Often pairs similar tones' },
  ],
  archetype: 'Casual Minimalist',
  outfitsAnalyzed: 42,
};

function renderCard() {
  return render(<StyleDNACard />);
}

describe('StyleDNACard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders without crashing when data is available', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('Style DNA')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    mockUseStyleDNA.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderCard();
    expect(container.querySelectorAll('[class*="skeleton-shimmer"]').length).toBeGreaterThanOrEqual(1);
  });

  it('returns null when no data and not loading', () => {
    mockUseStyleDNA.mockReturnValue({ data: null, isLoading: false });
    const { container } = renderCard();
    expect(container.innerHTML).toBe('');
  });

  it('displays the archetype name', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('Casual Minimalist')).toBeInTheDocument();
  });

  it('shows outfits analyzed count', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('42 outfits')).toBeInTheDocument();
  });

  it('renders signature color names', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.getByText('Navy')).toBeInTheDocument();
    expect(screen.getByText('White')).toBeInTheDocument();
  });

  it('renders pattern bars with strength percentage', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('Monochrome tendency')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('renders uniform combo formulas', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText('t-shirt + jeans + sneakers')).toBeInTheDocument();
    expect(screen.getByText('8×')).toBeInTheDocument();
  });

  it('hides combos section when uniformCombos is empty', () => {
    mockUseStyleDNA.mockReturnValue({
      data: { ...baseDNA, uniformCombos: [] },
      isLoading: false,
    });
    renderCard();
    expect(screen.queryByText('Go-to formulas')).not.toBeInTheDocument();
  });

  it('hides patterns section when patterns is empty', () => {
    mockUseStyleDNA.mockReturnValue({
      data: { ...baseDNA, patterns: [] },
      isLoading: false,
    });
    renderCard();
    expect(screen.queryByText('Detected patterns')).not.toBeInTheDocument();
  });

  it('shows formality info based on narrow spread', () => {
    mockUseStyleDNA.mockReturnValue({ data: baseDNA, isLoading: false });
    renderCard();
    expect(screen.getByText(/Consistent formality/)).toBeInTheDocument();
  });

  it('shows wide range dresser for wide spread', () => {
    mockUseStyleDNA.mockReturnValue({
      data: { ...baseDNA, formalitySpread: 'wide' },
      isLoading: false,
    });
    renderCard();
    expect(screen.getByText(/Wide range dresser/)).toBeInTheDocument();
  });
});
