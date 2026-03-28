import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WardrobeSmartAccess } from '../WardrobeSmartAccess';

describe('WardrobeSmartAccess', () => {
  it('renders smart collection tiles', () => {
    render(
      <WardrobeSmartAccess
        tiles={[
          { key: 'rarely_worn', label: 'Rarely worn', count: 4, active: false },
          { key: 'most_worn', label: 'Most worn', count: 2, active: true },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Smart access')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rarely worn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Most worn/i })).toBeInTheDocument();
  });

  it('toggles a tile on and off', () => {
    const onSelect = vi.fn();

    render(
      <WardrobeSmartAccess
        tiles={[
          { key: 'new', label: 'Recently added', count: 3, active: true },
        ]}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Recently added/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
