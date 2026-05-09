// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: tests for the web-only PaywallModal Stripe checkout flow.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// Wave 8 P55 — additional mocks for AuthContext (component now reads
// `user.id` for cache-key construction), react-query (Restore Purchase
// invalidates the subscription query), and sonner (success/info/error
// toasts on restore outcomes).
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user-id' } })),
}));

const invalidateQueriesMock = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: invalidateQueriesMock })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { PaywallModal } from '../PaywallModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

describe('PaywallModal smoke', () => {
  const onClose = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateQueriesMock.mockReset();
  });

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

  // Wave 8 P53 — two new reasons for the locked-state paywall.
  it('renders subscription_required title + body keys', () => {
    render(<PaywallModal isOpen={true} onClose={onClose} reason="subscription_required" />);
    expect(screen.getByText('paywall.subscription_required.title')).toBeInTheDocument();
    expect(screen.getByText('paywall.subscription_required.body')).toBeInTheDocument();
  });

  it('renders trial_expired title + body keys', () => {
    render(<PaywallModal isOpen={true} onClose={onClose} reason="trial_expired" />);
    expect(screen.getByText('paywall.trial_expired.title')).toBeInTheDocument();
    expect(screen.getByText('paywall.trial_expired.body')).toBeInTheDocument();
  });

  // Wave 8 P55 — Restore Purchase flow.
  describe('Restore Purchase (P55)', () => {
    it('renders Restore Purchase button on every reason (App Store guideline 3.1.1)', () => {
      const reasons = ['garments', 'outfits', 'subscription_required', 'trial_expired'] as const;
      for (const reason of reasons) {
        const { unmount } = render(<PaywallModal isOpen={true} onClose={onClose} reason={reason} />);
        // aria-label scopes by exact match — avoids ambiguity with the
        // benefit-list copy that may include similar phrasing in the future.
        expect(screen.getByLabelText('paywall.restore_purchase')).toBeInTheDocument();
        unmount();
      }
    });

    it('invalidates subscription cache, toasts success, and closes on active subscription', async () => {
      const invokeMock = vi.mocked(supabase.functions.invoke);
      invokeMock.mockResolvedValueOnce({
        data: { plan: 'premium', status: 'active' } as unknown,
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      render(<PaywallModal isOpen={true} onClose={onClose} reason="subscription_required" />);
      fireEvent.click(screen.getByLabelText('paywall.restore_purchase'));

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('restore_subscription', { body: {} });
        expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['subscription', 'test-user-id'] });
        // Code-reviewer P2 #1 — parity with BillingSuccess.tsx
        expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['stripe-subscription'] });
        expect(toast.success).toHaveBeenCalledWith('paywall.restore_success');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('also closes on trialing subscription (not just active)', async () => {
      // Fresh trial restore — uncommon but legal: a user paid up the trial on
      // another device and restores here. We treat trialing the same as active.
      const invokeMock = vi.mocked(supabase.functions.invoke);
      invokeMock.mockResolvedValueOnce({
        data: { plan: 'premium', status: 'trialing' } as unknown,
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      render(<PaywallModal isOpen={true} onClose={onClose} reason="trial_expired" />);
      fireEvent.click(screen.getByLabelText('paywall.restore_purchase'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('paywall.restore_success');
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('invalidates cache + shows info toast and stays open when no active subscription found', async () => {
      // restore_subscription returns plan='free' when no Stripe customer
      // exists OR when the customer has no active subscription. The edge fn
      // also writes plan='free' to the DB rows in this branch, so we still
      // bust the cache (code-reviewer P2 #2) so useSubscription self-heals
      // any locally-stale 'premium' state. Modal stays open so the user can
      // proceed with checkout.
      const invokeMock = vi.mocked(supabase.functions.invoke);
      invokeMock.mockResolvedValueOnce({
        data: { plan: 'free', status: null } as unknown,
        error: null,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      render(<PaywallModal isOpen={true} onClose={onClose} reason="subscription_required" />);
      fireEvent.click(screen.getByLabelText('paywall.restore_purchase'));

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('paywall.restore_no_subscription');
        expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['subscription', 'test-user-id'] });
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('shows error toast and stays open on transport error', async () => {
      const invokeMock = vi.mocked(supabase.functions.invoke);
      invokeMock.mockResolvedValueOnce({
        data: null,
        error: { message: 'fetch failed' } as unknown,
      } as Awaited<ReturnType<typeof supabase.functions.invoke>>);

      render(<PaywallModal isOpen={true} onClose={onClose} reason="trial_expired" />);
      fireEvent.click(screen.getByLabelText('paywall.restore_purchase'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('paywall.restore_error');
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('shows error toast on thrown exception', async () => {
      const invokeMock = vi.mocked(supabase.functions.invoke);
      invokeMock.mockRejectedValueOnce(new Error('network down'));

      render(<PaywallModal isOpen={true} onClose={onClose} reason="trial_expired" />);
      fireEvent.click(screen.getByLabelText('paywall.restore_purchase'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('paywall.restore_error');
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
