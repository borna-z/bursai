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

describe('PageHeader safe-area coverage', () => {
  it('renders a safe-area cover element with var(--safe-area-top) height', () => {
    const { container } = renderHeader();
    const cover = container.querySelector('[data-safe-area-cover="true"]') as HTMLElement | null;
    expect(cover).not.toBeNull();
    // The height may be expressed via either style attribute or a Tailwind
    // arbitrary-value class — JSDOM rejects var() on the height CSS property
    // when set via inline style, so we accept either form.
    const style = cover?.getAttribute('style') ?? '';
    const className = cover?.className ?? '';
    expect(style + ' ' + className).toContain('var(--safe-area-top)');
  });

  it('root uses the canonical z-header scale variable', () => {
    const { container } = renderHeader();
    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const style = header?.getAttribute('style') ?? '';
    const className = header?.className ?? '';
    expect(style + className).toMatch(/--z-header|z-\[var\(--z-header\)\]/);
  });
});
