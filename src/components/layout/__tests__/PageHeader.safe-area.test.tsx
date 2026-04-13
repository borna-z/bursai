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
});
