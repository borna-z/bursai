// DEPRECATED — web-only Stripe path, scheduled for deletion post-launch.
// Retained until web app removal. Do NOT add new callers; mobile uses RevenueCat exclusively.
// N10 hygiene marker: reads stripe_mode/stripe_customer_id from subscriptions and offers a portal session.
import { useState } from 'react';
import { Crown, Infinity as InfinityIcon, Sparkles, Loader2, Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Subscription } from '@/hooks/useSubscription';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { logger } from '@/lib/logger';

// Wave 8 P53 — `subscription` shape comes from the new `subscriptions`
// table (not the legacy `user_subscriptions` mirror). The legacy
// `outfits_used_month` field doesn't exist on the new row, but that
// quota UI is dead now anyway because there's no free tier — the
// `!isPremium` branch only fires for locked users, who see CTAs not
// quotas. We defensively read the field as optional so the type stays
// clean.
interface PremiumSectionProps {
  isPremium: boolean;
  subscription: Subscription | null | undefined;
  limits: {
    maxGarments: number;
    maxOutfitsPerMonth: number;
  };
}

export function PremiumSection({ isPremium, subscription, limits }: PremiumSectionProps) {
  const [isLoadingCheckout, setIsLoadingCheckout] = useState<'monthly' | 'yearly' | null>(null);
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const pricing = getLocalizedPricing(locale);

  const [stripeSubscription, setStripeSubscription] = useState<{
    status: string | null;
    stripeMode: string | null;
  } | null>(null);

  useState(() => {
    const fetchStripeStatus = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('subscriptions')
        .select('status, stripe_mode')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setStripeSubscription({ status: data.status, stripeMode: data.stripe_mode });
      }
    };
    fetchStripeStatus();
  });

  const isPastDue = stripeSubscription?.status === 'past_due';
  const isTestMode = stripeSubscription?.stripeMode === 'test';

  const handleUpgrade = async (plan: 'monthly' | 'yearly') => {
    const nav = prepareExternalNavigation();
    setIsLoadingCheckout(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create_checkout_session', { body: { plan, locale: navigator.language || document.documentElement.lang || 'sv' } });
      if (error) { logger.error('Checkout error:', error); nav.closePopup(); toast.error(t('premium.checkout_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { logger.error('Checkout error:', err); nav.closePopup(); toast.error(t('premium.error')); }
    finally { setIsLoadingCheckout(null); }
  };

  const handleManageSubscription = async () => {
    const nav = prepareExternalNavigation();
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_portal_session');
      if (error) { logger.error('Portal error:', error); nav.closePopup(); toast.error(t('premium.portal_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { logger.error('Portal error:', err); nav.closePopup(); toast.error(t('premium.error')); }
    finally { setIsLoadingPortal(false); }
  };

  const handleRestoreSubscription = async () => {
    setIsRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore_subscription');
      if (error) { logger.error('Restore error:', error); toast.error(t('premium.restore_error')); return; }
      if (data?.success) { toast.success(data.message); queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] }); }
      else { toast.error(data?.error || t('premium.error')); }
    } catch (err) { logger.error('Restore error:', err); toast.error(t('premium.error')); }
    finally { setIsRestoring(false); }
  };

  return (
    <Card className={cn(isPremium ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30' : '')}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className={cn("w-5 h-5", isPremium && "text-amber-500")} />
            <CardTitle className="text-base">{isPremium ? 'Premium' : 'Free'}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isTestMode && (
              <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                {t('premium.test_mode')}
              </Badge>
            )}
            {isPremium && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">{t('premium.active')}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPastDue && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription>{t('premium.past_due')}</AlertDescription>
          </Alert>
        )}

        {isPremium && !isPastDue ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <InfinityIcon className="w-4 h-4 text-amber-500" />
                <span>{t('premium.unlimited_wardrobe')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{t('premium.unlimited_outfits')}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={handleManageSubscription} disabled={isLoadingPortal}>
              {isLoadingPortal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
              {t('premium.manage')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Wave 8 P53 — quota progress UI dropped (free tier is gone, this
                branch only renders for locked / past-due users who need the
                upgrade CTA, not quota meters). `subscription` and `limits`
                refs left in the prop interface for future re-introduction if
                we add a downgraded UX. The empty quota `<p>` was removed in
                Wave 8 PR 2 code-review (P2 finding) — `limits.maxGarments`
                is now always `Infinity` so the conditional always rendered
                an empty `<p>`. */}
            <div className="space-y-2">
              <p className="text-center text-xs font-medium text-amber-600">{t('trial.first_free')}</p>
              <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" onClick={() => handleUpgrade('monthly')} disabled={isLoadingCheckout !== null}>
                {isLoadingCheckout === 'monthly' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
                {t('trial.start_button')}
              </Button>
              <Button variant="outline" className="w-full border-amber-500/50 hover:bg-amber-500/10" onClick={() => handleUpgrade('yearly')} disabled={isLoadingCheckout !== null}>
                {isLoadingCheckout === 'yearly' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2 text-amber-500" />}
                {pricing.yearly}{t('pricing.per_year')}
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={handleRestoreSubscription} disabled={isRestoring}>
              {isRestoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {t('premium.restore')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}