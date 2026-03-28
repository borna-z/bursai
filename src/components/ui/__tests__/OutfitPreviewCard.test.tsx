import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ui/OutfitComposition', () => ({
  OutfitComposition: ({
    className,
    items,
  }: {
    className?: string;
    items?: Array<{ id?: string }> | null;
  }) => (
    <div
      data-testid="outfit-composition"
      data-item-count={items?.length ?? 0}
      className={className}
    />
  ),
}));

import { OutfitPreviewCard } from '../OutfitPreviewCard';

describe('OutfitPreviewCard', () => {
  it('renders metadata, excerpt, footer, and custom surface classes', () => {
    const { container } = render(
      <OutfitPreviewCard
        items={[{ id: 'item-1' }, { id: 'item-2' }] as never}
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
    expect(screen.getByTestId('outfit-composition')).toHaveAttribute('data-item-count', '2');
    expect(container.firstChild).toHaveClass('custom-card');
    expect(container.querySelector('.custom-media')).toBeInTheDocument();
    expect(container.querySelector('.custom-content')).toBeInTheDocument();
  });

  it('keeps the shared media composition even when no text sections are provided', () => {
    const { container } = render(
      <OutfitPreviewCard items={[{ id: 'item-1' }] as never} />,
    );

    expect(screen.getByTestId('outfit-composition')).toHaveAttribute('data-item-count', '1');
    expect(container.querySelector('.px-4')).not.toBeInTheDocument();
  });
});
