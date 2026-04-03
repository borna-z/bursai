import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders non-sticky header chrome only when sticky is false', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Wardrobe" sticky={false} />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).not.toContain('topbar-frost');
    expect(header.className).not.toContain('sticky');
  });

  it('keeps frosted sticky behavior when sticky is true', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Plan" />
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(header.className).toContain('topbar-frost');
    expect(header.className).toContain('sticky');
  });
});
