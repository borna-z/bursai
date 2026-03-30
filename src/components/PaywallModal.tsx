import { useState } from 'react';
import { Crown, Infinity as InfinityIcon, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { logger } from '@/lib/logger';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'garments' | 'outfits';
}

export function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState<'monthly' | 'yearly' | null>(null);
  const { t, locale } = useLanguage();
  const pricing = getLocalizedPricing(locale);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full gradient-premium flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="font-display italic text-2xl">{t('paywall.title')}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {reason === 'garments'
              ? t('paywall.garment_limit')
              : t('paywall.outfit_limit')}
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
          <Button variant="ghost" className="w-full" onClick={onClose} disabled={isLoading !== null}>
            {t('paywall.not_now')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}