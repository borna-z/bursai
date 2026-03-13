import { useState } from 'react';
import { Crown, Infinity, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';

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
      if (error) { console.error('Checkout error:', error); nav.closePopup(); toast.error(t('premium.checkout_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { console.error('Checkout error:', err); nav.closePopup(); toast.error(t('premium.error')); }
    finally { setIsLoading(null); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl">{t('paywall.title')}</DialogTitle>
          <DialogDescription className="text-base">
            {reason === 'garments' ? t('paywall.garment_limit') : t('paywall.outfit_limit')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-6">
          <div className="flex items-center gap-3 p-3 bg-secondary/60 backdrop-blur-sm rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Infinity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t('premium.unlimited_wardrobe')}</p>
              <p className="text-sm text-muted-foreground">{t('paywall.unlimited_wardrobe_desc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-secondary/60 backdrop-blur-sm rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t('premium.unlimited_outfits')}</p>
              <p className="text-sm text-muted-foreground">{t('paywall.unlimited_outfits_desc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-secondary/60 backdrop-blur-sm rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t('premium.smarter_ai')}</p>
              <p className="text-sm text-muted-foreground">{t('paywall.smarter_desc')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-center text-sm font-medium text-amber-600">{t('trial.first_free')}</p>
          <Button className="w-full h-12 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" onClick={() => handleStartPremium('monthly')} disabled={isLoading !== null}>
            {isLoading === 'monthly' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
            {t('trial.start_button')}
          </Button>
          <Button variant="outline" className="w-full h-12 text-base border-amber-500/50 hover:bg-amber-500/10" onClick={() => handleStartPremium('yearly')} disabled={isLoading !== null}>
            {isLoading === 'yearly' ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2 text-amber-500" />}
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