// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: this modal posts to create_checkout_session + restore_subscription (Stripe).
import { useState } from 'react';
import { Crown, Infinity as InfinityIcon, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { logger } from '@/lib/logger';

// Wave 8 P53 — add two new reasons sourced from the locked-subscription
// state machine: `subscription_required` (no row / never trialed) and
// `trial_expired` (trial ended without conversion). The original two
// (`garments` / `outfits`) are kept as legacy paths but with the free tier
// removed they should now only fire if a locked user somehow reaches a
// quota check before the broader paywall gate redirects them.
interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'garments' | 'outfits' | 'subscription_required' | 'trial_expired';
}

export function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  // Wave 8 P55 — extended loading-state union to include `'restore'` so
  // every CTA shares the same disabled-while-busy guard. App Store review
  // (Apple Guideline 3.1.1) requires the Restore Purchase button to be
  // visible on every paywall surface — the modal is the canonical paywall
  // for both web + iOS web-wrap, so the button lives here. On iOS native
  // wrap we'd swap the underlying invoke for StoreKit's `restoreCompletedTransactions`
  // — out of scope here (Wave 9 / Capacitor migration owns native receipt
  // restore).
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | 'restore' | null>(null);
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pricing = getLocalizedPricing(locale);

  const titleKey =
    reason === 'subscription_required'
      ? 'paywall.subscription_required.title'
      : reason === 'trial_expired'
        ? 'paywall.trial_expired.title'
        : 'paywall.title';

  const bodyKey =
    reason === 'subscription_required'
      ? 'paywall.subscription_required.body'
      : reason === 'trial_expired'
        ? 'paywall.trial_expired.body'
        : reason === 'garments'
          ? 'paywall.garment_limit'
          : 'paywall.outfit_limit';

  const handleStartPremium = async (plan: 'monthly' | 'yearly') => {
    const nav = prepareExternalNavigation();
    setIsLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create_checkout_session', { body: { plan, locale: navigator.language || document.documentElement.lang || 'sv' } });
      if (error) { logger.error('Checkout error:', error); nav.closePopup(); toast.error(t('premium.checkout_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { logger.error('Checkout error:', err); nav.closePopup(); toast.error(t('premium.error')); }
    finally { setIsLoading(null); }
  };

  // Wave 8 P55 — Restore Purchase. Calls the existing `restore_subscription`
  // edge function (P9 added rate-limiting; P53 didn't touch the fn). The fn
  // looks up the Stripe customer by user.email, pulls the most recent
  // subscription, mirrors the canonical state to both `subscriptions` and
  // legacy `user_subscriptions`, and returns `{ plan, status, currentPeriodEnd }`.
  // Three outcomes:
  //   1. Active/trialing subscription found → invalidate React Query so
  //      `useSubscription` re-derives state to 'premium'/'trialing', toast
  //      success, close modal. Parent screen unblocks naturally.
  //   2. No subscription / inactive subscription found → toast info with
  //      a "no subscription" message. Modal stays open so the user can
  //      proceed with checkout if this was a billing-history mismatch.
  //   3. Network / 5xx / auth error → toast error. Modal stays open.
  // We never block the modal on Stripe transport latency; user can dismiss
  // mid-call via "Not now" and the in-flight invoke completes harmlessly.
  const handleRestore = async () => {
    setIsLoading('restore');
    try {
      const { data, error } = await supabase.functions.invoke('restore_subscription', { body: {} });
      if (error) {
        logger.error('Restore error:', error);
        toast.error(t('paywall.restore_error'));
        return;
      }
      const plan = (data as { plan?: string } | null)?.plan;
      const status = (data as { status?: string } | null)?.status;
      const isActive = plan === 'premium' && (status === 'active' || status === 'trialing');
      if (isActive) {
        // Bust the subscription cache so useSubscription re-fetches and
        // re-derives state. Parents listening to `isPremium` / `state`
        // re-render with the unlocked state and any paywall-gated UI clears.
        queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
        // Also bust the legacy `stripe-subscription` key for parity with
        // BillingSuccess.tsx — currently a no-op (no useQuery defines that
        // key) but kept defensive so a future legacy hook revival doesn't
        // diverge from the canonical cache here.
        queryClient.invalidateQueries({ queryKey: ['stripe-subscription'] });
        toast.success(t('paywall.restore_success'));
        onClose();
      } else {
        // No active subscription found. The edge fn just wrote
        // `plan='free', status=null` to BOTH `subscriptions` and
        // `user_subscriptions` tables (lines 112-126 of restore_subscription/
        // index.ts), so any locally-cached row that previously held stale
        // 'premium' is now divergent from DB. Bust the cache so
        // useSubscription re-fetches and reflects the corrected truth —
        // self-healing for users whose Stripe state was edited admin-side.
        queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
        toast.info(t('paywall.restore_no_subscription'));
      }
    } catch (err) {
      logger.error('Restore error:', err);
      toast.error(t('paywall.restore_error'));
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full gradient-premium flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="font-display italic text-2xl">{t(titleKey)}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {t(bodyKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 my-6">
          {[
            { icon: Crown, title: t('paywall.stylist_mode'), desc: t('paywall.stylist_mode_desc') },
            { icon: InfinityIcon, title: t('premium.unlimited_wardrobe'), desc: t('paywall.unlimited_desc') },
            { icon: Sparkles, title: t('premium.smarter_ai'), desc: t('paywall.smarter_desc') },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-3 bg-secondary/40 rounded-[1.25rem]">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-medium">{title}</p>
                <p className="text-[11px] text-muted-foreground/70 leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-center text-sm font-medium text-premium">{t('trial.first_free')}</p>
          <Button className="w-full h-12 text-base gradient-premium text-premium-foreground hover:opacity-90" onClick={() => handleStartPremium('monthly')} disabled={isLoading !== null}>
            {isLoading === 'monthly' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
            {t('trial.start_button')}
          </Button>
          <Button variant="outline" className="w-full h-12 text-base border-premium/50 hover:bg-premium/10" onClick={() => handleStartPremium('yearly')} disabled={isLoading !== null}>
            {isLoading === 'yearly' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2 text-premium" />}
            {pricing.yearly}{t('pricing.per_year')}
          </Button>
          {/* Wave 8 P55 — Restore Purchase. App Store guideline 3.1.1 requires
              this control to be visible on every paywall. Visually a link-style
              button so it doesn't compete with the primary subscription CTAs,
              but always rendered + always tappable when not mid-flight. */}
          <Button
            type="button"
            variant="link"
            className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
            onClick={handleRestore}
            disabled={isLoading !== null}
            aria-label={t('paywall.restore_purchase')}
          >
            {isLoading === 'restore' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            {t('paywall.restore_purchase')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={isLoading !== null}>
            {t('paywall.not_now')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}