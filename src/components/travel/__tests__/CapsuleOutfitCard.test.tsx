import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CapsuleOutfitCard } from '../CapsuleOutfitCard';

describe('CapsuleOutfitCard', () => {
  it('does not render incomplete travel outfits', () => {
    render(
      <CapsuleOutfitCard
        outfit={{
          day: 1,
          occasion: 'casual',
          items: ['top-1', 'bottom-1'],
          note: 'Incomplete look',
        }}
        animationIndex={0}
        garmentMap={new Map([
          ['top-1', { id: 'top-1', title: 'White Shirt', image_path: '', category: 'top' }],
          ['bottom-1', { id: 'bottom-1', title: 'Black Trousers', image_path: '', category: 'bottom' }],
        ])}
        allGarmentsMap={new Map()}
      />,
    );

    expect(screen.queryByText('Incomplete look')).not.toBeInTheDocument();
  });
});
