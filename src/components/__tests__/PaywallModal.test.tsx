import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({ t: (k: string) => k, locale: 'en' })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock('@/lib/localizedPricing', () => ({
  getLocalizedPricing: vi.fn(() => ({ monthly: '$9', yearly: '$79' })),
}));

vi.mock('@/lib/externalNavigation', () => ({
  prepareExternalNavigation: vi.fn(() => ({ go: vi.fn(), closePopup: vi.fn() })),
}));

import { PaywallModal } from '../PaywallModal';

describe('PaywallModal smoke', () => {
  const onClose = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it('renders crown icon and upgrade buttons when open', () => {
    render(<PaywallModal isOpen={true} onClose={onClose} reason="garments" />);
    expect(screen.getByText('paywall.title')).toBeInTheDocument();
    expect(screen.getByText('paywall.garment_limit')).toBeInTheDocument();
    expect(screen.getByText('trial.start_button')).toBeInTheDocument();
  });

  it('renders "not now" button and calls onClose', () => {
    render(<PaywallModal isOpen={true} onClose={onClose} reason="outfits" />);
    const notNow = screen.getByText('paywall.not_now');
    expect(notNow).toBeInTheDocument();
    fireEvent.click(notNow);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(<PaywallModal isOpen={false} onClose={onClose} reason="garments" />);
    expect(screen.queryByText('paywall.title')).not.toBeInTheDocument();
  });
});
