import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDnaSnapshot } from '../HomeDnaSnapshot';

const baseProps = {
  onOpenInsights: vi.fn(),
  onGenerateLook: vi.fn(),
};

describe('HomeDnaSnapshot', () => {
  it('renders loading state', () => {
    render(<HomeDnaSnapshot {...baseProps} dna={null} isLoading />);
    expect(screen.getByTestId('home-dna-loading')).toBeInTheDocument();
  });

  it('renders empty state when dna is unavailable', () => {
    render(<HomeDnaSnapshot {...baseProps} dna={null} />);
    expect(screen.getByTestId('home-dna-empty')).toBeInTheDocument();
    expect(screen.getByText('DNA is still forming')).toBeInTheDocument();
    expect(screen.getByText('Style Me')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Style Me/i })).toBeInTheDocument();
  });

  it('renders populated dna summary', () => {
    render(
      <HomeDnaSnapshot
        {...baseProps}
        dna={{
          archetype: 'Minimalist',
          outfitsAnalyzed: 12,
          signatureColors: [
            { color: 'black', percentage: 48 },
            { color: 'white', percentage: 26 },
            { color: 'navy', percentage: 12 },
          ],
          uniformCombos: [{ combo: ['tee', 'trousers', 'sneakers'], count: 6 }],
          patterns: [{ label: 'Neutral palette', strength: 88, detail: 'Mostly neutrals' }],
          formalityCenter: 2.8,
          formalitySpread: 'moderate',
        }}
      />,
    );

    expect(screen.getByTestId('home-dna-populated')).toBeInTheDocument();
    expect(screen.getByText('Minimalist')).toBeInTheDocument();
    expect(screen.getByText('Palette')).toBeInTheDocument();
    expect(screen.getByText('Formula')).toBeInTheDocument();
    expect(screen.getByText('Neutral palette')).toBeInTheDocument();
    expect(screen.getByText('Signature colors')).toBeInTheDocument();
    expect(screen.getByText('12 looks analyzed')).toBeInTheDocument();
    expect(screen.getByText('Open DNA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open DNA/i })).toBeInTheDocument();
  });
});
