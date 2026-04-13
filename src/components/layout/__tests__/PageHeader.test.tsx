import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('always renders frost sticky chrome regardless of deprecated sticky prop', () => {
    render(
      <MemoryRouter>
        {/* sticky prop is deprecated but still accepted (Insights compat). It is now a no-op. */}
        <PageHeader title="Wardrobe" sticky={false} />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('topbar-frost');
    expect(header.className).toContain('sticky');
    expect(header.getAttribute('data-variant')).toBe('solid');
  });

  it('renders the solid variant by default', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Plan" />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('topbar-frost');
    expect(header.className).toContain('sticky');
    expect(header.getAttribute('data-variant')).toBe('solid');
  });
});
