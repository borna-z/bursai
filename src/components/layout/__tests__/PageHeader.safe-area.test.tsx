import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { PageHeader } from '../PageHeader';

function renderHeader() {
  return render(
    <MemoryRouter>
      <PageHeader title="Test" />
    </MemoryRouter>,
  );
}

describe('PageHeader z-index and sticky behavior', () => {
  it('root uses the canonical z-header scale variable', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const style = header?.getAttribute('style') ?? '';
    const className = header?.className ?? '';
    expect(style + className).toMatch(/--z-header|z-\[var\(--z-header\)\]/);
  });

  it('does not render an internal safe-area cover (AppLayout owns it)', () => {
    const { container } = renderHeader();
    // Safe-area coverage is owned by AppLayout so every page gets it, not
    // just pages that happen to use PageHeader. Regression guard against the
    // initial Phase 1 design that duplicated coverage inside the header.
    const cover = container.querySelector('[data-safe-area-cover="true"]');
    expect(cover).toBeNull();
  });

  it('renders the overlay variant with transparent background', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Garment" variant="overlay" showBack />
      </MemoryRouter>,
    );
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(header?.getAttribute('data-variant')).toBe('overlay');
    expect(header?.className ?? '').toContain('bg-transparent');
    expect(header?.className ?? '').not.toContain('topbar-frost');
  });

  it('overlay variant back button uses image-friendly blur pill styling', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Garment" variant="overlay" showBack />
      </MemoryRouter>,
    );
    const backButton = container.querySelector('button[aria-label="Go back"]');
    expect(backButton).not.toBeNull();
    const cls = backButton?.className ?? '';
    expect(cls).toContain('backdrop-blur');
    expect(cls).toContain('text-white');
  });

  it('solid variant back button uses standard editorial styling', () => {
    const { container } = render(
      <MemoryRouter>
        <PageHeader title="Wardrobe" variant="solid" showBack />
      </MemoryRouter>,
    );
    const backButton = container.querySelector('button[aria-label="Go back"]');
    expect(backButton).not.toBeNull();
    const cls = backButton?.className ?? '';
    expect(cls).toContain('text-foreground');
    expect(cls).not.toContain('backdrop-blur');
  });
});
