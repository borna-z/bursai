import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StyleDNACard } from '../StyleDNACard';

describe('StyleDNACard', () => {
  it('renders the provided dna payload without any fallback hook dependency', () => {
    render(
      <StyleDNACard
        dna={{
          archetype: 'Minimalist',
          outfitsAnalyzed: 18,
          signatureColors: [
            { color: 'black', percentage: 42 },
            { color: 'white', percentage: 28 },
            { color: 'navy', percentage: 14 },
          ],
          uniformCombos: [{ combo: ['tee', 'trousers', 'sneakers'], count: 5 }],
          patterns: [{ label: 'Neutral palette', strength: 88, detail: 'Mostly neutrals' }],
          formalityCenter: 2.7,
          formalitySpread: 'moderate',
        }}
      />,
    );

    expect(screen.getByText('Minimalist')).toBeInTheDocument();
    expect(screen.getByText('18 outfits')).toBeInTheDocument();
    expect(screen.getByText('tee + trousers + sneakers')).toBeInTheDocument();
    expect(screen.getByText('Neutral palette')).toBeInTheDocument();
    expect(screen.getByText(/Balanced range/i).textContent).toContain('· F2.7');
  });

  it('renders a supplied empty state when dna is unavailable', () => {
    render(<StyleDNACard emptyState={<div>DNA empty state</div>} />);

    expect(screen.getByText('DNA empty state')).toBeInTheDocument();
  });
});
