import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: ({ className }: { className?: string }) => (
    <div data-testid="outfit-composition" className={className} />
  ),
}));

import { OutfitPreviewCard } from '../OutfitPreviewCard';

describe('OutfitPreviewCard', () => {
  it('renders metadata, excerpt, footer, and custom surface classes', () => {
    const { container } = render(
      <OutfitPreviewCard
        meta={<div>Work</div>}
        excerpt="Soft tailoring with an easy finish."
        footer={<div>Generated Tue, 28 Mar</div>}
        className="custom-card"
        mediaClassName="custom-media"
        contentClassName="custom-content"
        compositionClassName="custom-composition"
      />,
    );

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Soft tailoring with an easy finish.')).toBeInTheDocument();
    expect(screen.getByText('Generated Tue, 28 Mar')).toBeInTheDocument();
    expect(screen.getByTestId('outfit-composition')).toHaveClass('custom-composition');
    expect(container.firstChild).toHaveClass('custom-card');
    expect(container.querySelector('.custom-media')).toBeInTheDocument();
    expect(container.querySelector('.custom-content')).toBeInTheDocument();
  });
});
