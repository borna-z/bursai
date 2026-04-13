import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <div data-testid="helmet">{children}</div>,
}));

vi.mock('@/lib/haptics', () => ({ hapticLight: vi.fn() }));

import PrivacyPolicy from '../marketing/PrivacyPolicy';

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPolicy />
    </MemoryRouter>,
  );
}

describe('PrivacyPolicy page', () => {
  it('renders the Privacy Policy heading', () => {
    renderPage();
    expect(screen.getAllByRole('heading', { level: 1, name: /privacy policy/i }).length).toBeGreaterThan(0);
  });

  it('contains key legal sections', () => {
    renderPage();
    expect(screen.getByText(/1\. Who We Are/)).toBeInTheDocument();
    expect(screen.getByText(/3\. What Data We Collect/)).toBeInTheDocument();
    expect(screen.getByText(/6\. Google API Services/)).toBeInTheDocument();
  });

  it('has a back button that calls navigate(-1)', () => {
    renderPage();
    fireEvent.click(screen.getByLabelText('Go back'));
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
