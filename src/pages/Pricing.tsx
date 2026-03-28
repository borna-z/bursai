import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { Crown, Check, Shield, Lock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { logger } from '@/lib/logger';

export default function PricingPage() {
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { question: t('pricing.faq1_q'), answer: t('pricing.faq1_a') },
    { question: t('pricing.faq2_q'), answer: t('pricing.faq2_a') },
    { question: t('pricing.faq3_q'), answer: t('pricing.faq3_a') },
    { question: t('pricing.faq4_q'), answer: t('pricing.faq4_a') },
  ];

  const trustBullets = [
    { icon: Lock, text: t('pricing.trust_private') },
    { icon: Shield, text: t('pricing.trust_own_data') },
    { icon: Check, text: t('pricing.trust_cancel') },
  ];

  const handleCheckout = async () => {
    const nav = prepareExternalNavigation();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create_checkout_session', { body: { plan: billingCycle, locale: navigator.language || document.documentElement.lang || 'sv' } });
      if (error) { logger.error('Checkout error:', error); nav.closePopup(); toast.error(t('premium.checkout_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { logger.error('Checkout error:', err); nav.closePopup(); toast.error(t('premium.error')); }
    finally { setIsLoading(false); }
  };

  const { locale } = useLanguage();
  const pricing = getLocalizedPricing(locale);

  return (
    <>
      <Helmet>
        <title>BURS Premium | Unlock Your Full Wardrobe</title>
        <meta name="description" content="Unlimited garments, unlimited outfits, smarter AI recommendations. Try BURS Premium free for 30 days." />
        <meta property="og:title" content="BURS Premium | Unlock Your Full Wardrobe" />
        <meta property="og:description" content="Unlimited garments, unlimited outfits, smarter AI recommendations. Try free for 30 days." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://burs.me/pricing" />
        <meta property="og:image" content="/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BURS Premium | Unlock Your Full Wardrobe" />
        <meta name="twitter:description" content="Unlimited garments, unlimited outfits, smarter AI recommendations. Try free for 30 days." />
      </Helmet>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PageHeader title={t('pricing.title') || 'Premium'} eyebrow="Upgrade" showBack />

      <div className="p-4 space-y-8 pb-24 max-w-lg mx-auto">
        {/* Trial banner */}
        <div className="surface-editorial rounded-[1.25rem] p-5 text-center space-y-3">
          <Badge className="bg-primary text-primary-foreground">{t('trial.badge')}</Badge>
          <h2 className="font-['Playfair_Display'] italic text-[1.4rem]">{t('trial.banner_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('trial.banner_desc')}</p>
        </div>

        {/* Hero */}
        <div className="text-center space-y-4 pt-4">
          <Crown className="w-10 h-10 mx-auto text-foreground" />
          <h2 className="font-['Playfair_Display'] italic text-[1.6rem]">{t('pricing.hero')}</h2>
          <p className="text-muted-foreground">{t('pricing.hero_desc')}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-2 p-1 bg-muted">
          <button className={cn('flex-1 min-h-[44px] py-2 px-4 text-sm font-medium transition-all', billingCycle === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBillingCycle('monthly')}>
            {t('pricing.monthly_label')}
          </button>
          <button className={cn('flex-1 min-h-[44px] py-2 px-4 text-sm font-medium transition-all relative', billingCycle === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBillingCycle('yearly')}>
            {t('pricing.yearly_label')}
            <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-1.5">-{pricing.savingsPercent}%</Badge>
          </button>
        </div>

        {/* Pricing card */}
        <div className="surface-editorial rounded-[1.25rem] p-5 space-y-4">
          <h3 className="text-center font-semibold flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" /> Premium
          </h3>
          <div className="text-center">
            {billingCycle === 'monthly' ? (
              <><span className="text-4xl font-bold">{pricing.monthly}</span><span className="text-muted-foreground">{t('pricing.per_month')}</span></>
            ) : (
              <><span className="text-4xl font-bold">{pricing.yearly}</span><span className="text-muted-foreground">{t('pricing.per_year')}</span>
              <p className="text-sm text-muted-foreground mt-1">≈ {pricing.yearlyMonthlyEquivalent}{t('pricing.per_month')} • {t('common.save') || 'Save'} {pricing.savingsPercent}%</p></>
            )}
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-foreground" /><span className="text-sm">{t('pricing.unlimited_wardrobe')}</span></div>
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-foreground" /><span className="text-sm">{t('pricing.unlimited_outfits')}</span></div>
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-foreground" /><span className="text-sm">{t('pricing.smarter_ai')}</span></div>
          </div>
          <p className="text-center text-sm font-medium text-muted-foreground">{t('trial.first_free')}</p>
          <p className="text-center text-xs text-muted-foreground">{t('trial.then_prefix')} {pricing.monthly}{t('pricing.per_month')} {t('common.or')} {pricing.yearly}{t('pricing.per_year')}</p>
          <Button className="h-14 w-full rounded-full text-[15px] font-medium" onClick={handleCheckout} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
            {t('trial.start_button')}
          </Button>
        </div>

        {/* Trust bullets */}
        <div className="space-y-3">
          {trustBullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
              <bullet.icon className="w-4 h-4 text-foreground flex-shrink-0" /><span>{bullet.text}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="space-y-0">
          <h3 className="font-['Playfair_Display'] italic text-lg mb-4">{t('pricing.faq_title')}</h3>
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border">
              <button className="w-full min-h-[44px] py-4 text-left flex items-center justify-between" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                <span className="font-medium text-sm">{faq.question}</span>
                {openFaq === index ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {openFaq === index && <div className="pb-4 text-sm text-muted-foreground">{faq.answer}</div>}
            </div>
          ))}
        </div>

        {/* Feature comparison */}
        <div className="space-y-3">
          <h3 className="font-['Playfair_Display'] italic text-lg">{t('pricing.compare_title') || 'Free vs Premium'}</h3>
          <div className="border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 font-medium">{t('pricing.feature') || 'Feature'}</th>
                  <th className="text-center p-3 font-medium">{t('pricing.free_title')}</th>
                  <th className="text-center p-3 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  [t('pricing.feature_garments') || 'Garments', '15', '∞'],
                  [t('pricing.feature_outfits') || 'Outfits/month', '5', '∞'],
                  [t('pricing.feature_ai') || 'AI Stylist', <Check key="f" className="w-4 h-4 mx-auto" />, <Check key="p" className="w-4 h-4 mx-auto" />],
                  [t('pricing.feature_planner') || 'Planner', <Check key="f" className="w-4 h-4 mx-auto" />, <Check key="p" className="w-4 h-4 mx-auto" />],
                  [t('pricing.feature_insights') || 'Insights', '—', <Check key="p" className="w-4 h-4 mx-auto" />],
                  [t('pricing.feature_priority') || 'Priority support', '—', <Check key="p" className="w-4 h-4 mx-auto" />],
                ].map(([feature, free, premium], i) => (
                  <tr key={i}>
                    <td className="p-3 text-muted-foreground">{feature}</td>
                    <td className="p-3 text-center">{free}</td>
                    <td className="p-3 text-center font-medium">{premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Free plan summary */}
        <div className="bg-muted p-4 border border-border">
          <h4 className="font-medium mb-2">{t('pricing.free_title')}</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• {t('pricing.free_1')}</li>
            <li>• {t('pricing.free_2')}</li>
            <li>• {t('pricing.free_3')}</li>
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}
