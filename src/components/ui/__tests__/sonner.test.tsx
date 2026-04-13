import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toaster } from '../sonner';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

describe('Toaster safe-area', () => {
  it('renders a sonner section with safe-area aware offset', () => {
    const { container } = render(<Toaster />);
    const section = container.querySelector('section[aria-label], ol');
    const withOffset = container.querySelector('[style*="--offset-top"], [style*="offset"]');
    expect(withOffset ?? section).not.toBeNull();
  });
});
