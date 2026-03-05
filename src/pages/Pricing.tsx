import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, Sparkles, Infinity, Shield, Lock, ArrowLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';

export default function PricingPage() {
  const navigate = useNavigate();
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
      const { data, error } = await supabase.functions.invoke('create_checkout_session', { body: { plan: billingCycle, locale: document.documentElement.lang || 'sv' } });
      if (error) { console.error('Checkout error:', error); nav.closePopup(); toast.error(t('premium.checkout_error')); return; }
      if (data?.url) { nav.go(data.url); } else { nav.closePopup(); toast.error(t('premium.no_link')); }
    } catch (err) { console.error('Checkout error:', err); nav.closePopup(); toast.error(t('premium.error')); }
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
        <meta property="og:image" content="https://burs.me/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BURS Premium | Unlock Your Full Wardrobe" />
        <meta name="twitter:description" content="Unlimited garments, unlimited outfits, smarter AI recommendations. Try free for 30 days." />
      </Helmet>
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-lg font-semibold">{t('pricing.title')}</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* Trial banner */}
        <div className="relative overflow-hidden rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-6 text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
          <Badge className="bg-amber-500 text-white mb-3">{t('trial.badge')}</Badge>
          <h2 className="text-xl font-bold mb-1">{t('trial.banner_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('trial.banner_desc')}</p>
        </div>

        <div className="text-center space-y-4 pt-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold">{t('pricing.hero')}</h2>
          <p className="text-muted-foreground">{t('pricing.hero_desc')}</p>
        </div>

        <div className="flex items-center justify-center gap-2 p-1 bg-secondary rounded-lg">
          <button className={cn('flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all', billingCycle === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBillingCycle('monthly')}>
            {t('pricing.monthly_label')}
          </button>
          <button className={cn('flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all relative', billingCycle === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')} onClick={() => setBillingCycle('yearly')}>
            {t('pricing.yearly_label')}
            <Badge className="absolute -top-2 -right-2 bg-green-500 text-xs px-1.5">-{pricing.savingsPercent}%</Badge>
          </button>
        </div>

        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />Premium
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              {billingCycle === 'monthly' ? (
                <><span className="text-4xl font-bold">{pricing.monthly}</span><span className="text-muted-foreground">{t('pricing.per_month')}</span></>
              ) : (
                <><span className="text-4xl font-bold">{pricing.yearly}</span><span className="text-muted-foreground">{t('pricing.per_year')}</span>
                <p className="text-sm text-green-600 mt-1">≈ {pricing.yearlyMonthlyEquivalent}{t('pricing.per_month')} • {t('common.save') || 'Save'} {pricing.savingsPercent}%</p></>
              )}
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Infinity className="w-4 h-4 text-amber-500" /></div><span className="text-sm">{t('pricing.unlimited_wardrobe')}</span></div>
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Sparkles className="w-4 h-4 text-amber-500" /></div><span className="text-sm">{t('pricing.unlimited_outfits')}</span></div>
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-500" /></div><span className="text-sm">{t('pricing.smarter_ai')}</span></div>
            </div>
            <p className="text-center text-sm font-medium text-amber-600">{t('trial.first_free')}</p>
            <p className="text-center text-xs text-muted-foreground">{t('trial.then_prefix')} {pricing.monthly}{t('pricing.per_month')} {t('common.or')} {pricing.yearly}{t('pricing.per_year')}</p>
            <Button className="w-full h-12 text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" onClick={handleCheckout} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
              {t('trial.start_button')}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {trustBullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground">
              <bullet.icon className="w-4 h-4 text-green-500 flex-shrink-0" /><span>{bullet.text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">{t('pricing.faq_title')}</h3>
          {faqs.map((faq, index) => (
            <Card key={index} className="overflow-hidden">
              <button className="w-full p-4 text-left flex items-center justify-between" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                <span className="font-medium text-sm">{faq.question}</span>
                {openFaq === index ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {openFaq === index && <div className="px-4 pb-4 text-sm text-muted-foreground">{faq.answer}</div>}
            </Card>
          ))}
        </div>

        <Card className="bg-secondary/50">
          <CardContent className="p-4">
            <h4 className="font-medium mb-2">{t('pricing.free_title')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t('pricing.free_1')}</li>
              <li>• {t('pricing.free_2')}</li>
              <li>• {t('pricing.free_3')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}