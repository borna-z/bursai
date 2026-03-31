import { useState } from 'react';
import { Helmet } from 'react-helmet-async';

import { Crown, Check, Shield, Lock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/lib/haptics';
import { prepareExternalNavigation } from '@/lib/externalNavigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { logger } from '@/lib/logger';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_CURVE } from '@/lib/motion';

export default function PricingPage() {
  const { t } = useLanguage();
  const prefersReduced = useReducedMotion();
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

  const stagger = (i: number) =>
    prefersReduced ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.35, ease: EASE_CURVE } };

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
      <PageHeader
        title={t('pricing.title') || 'Premium'}
        eyebrow="Upgrade"
        showBack
        titleClassName="font-display italic"
      />

      <div className="px-4 space-y-6 pb-24 max-w-lg mx-auto pt-2">
        {/* Trial banner */}
        <motion.div className="rounded-[1.25rem] p-6 text-center space-y-3" {...stagger(0)}>
          <Badge className="bg-primary text-primary-foreground rounded-full px-3">{t('trial.badge')}</Badge>
          <h2 className="font-display italic text-[1.4rem]">{t('trial.banner_title')}</h2>
          <p className="text-sm text-muted-foreground font-body">{t('trial.banner_desc')}</p>
        </motion.div>

        {/* Hero */}
        <motion.div className="text-center space-y-4 pt-2" {...stagger(1)}>
          <Crown className="w-10 h-10 mx-auto text-foreground" />
          <h2 className="font-display italic text-[1.6rem] leading-tight">{t('pricing.hero')}</h2>
          <p className="text-muted-foreground font-body text-sm">{t('pricing.hero_desc')}</p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          className="flex items-center justify-center gap-1 p-1 rounded-full bg-muted/60"
          {...stagger(2)}
        >
          <button
            className={cn(
              'flex-1 min-h-[44px] py-2 px-4 text-sm font-medium transition-all rounded-full cursor-pointer',
              billingCycle === 'monthly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => { hapticLight(); setBillingCycle('monthly'); }}
          >
            {t('pricing.monthly_label')}
          </button>
          <button
            className={cn(
              'flex-1 min-h-[44px] py-2 px-4 text-sm font-medium transition-all relative rounded-full cursor-pointer',
              billingCycle === 'yearly' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => { hapticLight(); setBillingCycle('yearly'); }}
          >
            {t('pricing.yearly_label')}
            <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">-{pricing.savingsPercent}%</Badge>
          </button>
        </motion.div>

        {/* Pricing card */}
        <motion.div className="rounded-[1.25rem] border border-border/40 p-6 space-y-5" {...stagger(3)}>
          <h3 className="text-center font-display italic text-[1.2rem] flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" /> Premium
          </h3>
          <div className="text-center">
            {billingCycle === 'monthly' ? (
              <><span className="text-4xl font-bold tracking-tight">{pricing.monthly}</span><span className="text-muted-foreground font-body ml-1">{t('pricing.per_month')}</span></>
            ) : (
              <><span className="text-4xl font-bold tracking-tight">{pricing.yearly}</span><span className="text-muted-foreground font-body ml-1">{t('pricing.per_year')}</span>
              <p className="text-sm text-muted-foreground font-body mt-1">{pricing.yearlyMonthlyEquivalent}{t('pricing.per_month')} · {t('common.save') || 'Save'} {pricing.savingsPercent}%</p></>
            )}
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-accent flex-shrink-0" /><span className="text-sm font-body">{t('pricing.unlimited_wardrobe')}</span></div>
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-accent flex-shrink-0" /><span className="text-sm font-body">{t('pricing.unlimited_outfits')}</span></div>
            <div className="flex items-center gap-3"><Check className="w-4 h-4 text-accent flex-shrink-0" /><span className="text-sm font-body">{t('pricing.smarter_ai')}</span></div>
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-center text-sm font-medium text-muted-foreground font-body">{t('trial.first_free')}</p>
            <p className="text-center text-xs text-muted-foreground/60 font-body">{t('trial.then_prefix')} {pricing.monthly}{t('pricing.per_month')} {t('common.or')} {pricing.yearly}{t('pricing.per_year')}</p>
          </div>
          <Button className="h-14 w-full rounded-full text-[15px] font-medium" onClick={() => { hapticLight(); handleCheckout(); }} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Crown className="w-5 h-5 mr-2" />}
            {t('trial.start_button')}
          </Button>
        </motion.div>

        {/* Trust bullets */}
        <motion.div className="space-y-3 px-2" {...stagger(4)}>
          {trustBullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-3 text-sm text-muted-foreground font-body">
              <bullet.icon className="w-4 h-4 text-foreground flex-shrink-0" /><span>{bullet.text}</span>
            </div>
          ))}
        </motion.div>

        {/* FAQ */}
        <motion.div className="space-y-0" {...stagger(5)}>
          <h3 className="font-display italic text-[1.2rem] mb-4">{t('pricing.faq_title')}</h3>
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border/60">
              <button
                className="w-full min-h-[44px] py-4 text-left flex items-center justify-between cursor-pointer"
                onClick={() => { hapticLight(); setOpenFaq(openFaq === index ? null : index); }}
              >
                <span className="font-medium text-sm font-body">{faq.question}</span>
                {openFaq === index ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
              </button>
              {openFaq === index && <div className="pb-4 text-sm text-muted-foreground font-body leading-relaxed">{faq.answer}</div>}
            </div>
          ))}
        </motion.div>

        {/* Feature comparison */}
        <motion.div className="space-y-3" {...stagger(6)}>
          <h3 className="font-display italic text-[1.2rem]">{t('pricing.compare_title') || 'Free vs Premium'}</h3>
          <div className="rounded-[1.25rem] border border-border/40 overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 font-medium">{t('pricing.feature') || 'Feature'}</th>
                  <th className="text-center p-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 font-medium">{t('pricing.free_title')}</th>
                  <th className="text-center p-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  [t('pricing.feature_garments') || 'Garments', '15', <span key="inf" className="text-accent font-semibold">∞</span>],
                  [t('pricing.feature_outfits') || 'Outfits/month', '5', <span key="inf" className="text-accent font-semibold">∞</span>],
                  [t('pricing.feature_ai') || 'AI Stylist', <Check key="f" className="w-4 h-4 mx-auto text-muted-foreground/40" />, <Check key="p" className="w-4 h-4 mx-auto text-accent" />],
                  [t('pricing.feature_planner') || 'Planner', <Check key="f" className="w-4 h-4 mx-auto text-muted-foreground/40" />, <Check key="p" className="w-4 h-4 mx-auto text-accent" />],
                  [t('pricing.feature_insights') || 'Insights', <span key="d" className="text-muted-foreground/40">—</span>, <Check key="p" className="w-4 h-4 mx-auto text-accent" />],
                  [t('pricing.feature_priority') || 'Priority support', <span key="d" className="text-muted-foreground/40">—</span>, <Check key="p" className="w-4 h-4 mx-auto text-accent" />],
                ].map(([feature, free, premium], i) => (
                  <tr key={i}>
                    <td className="p-4 text-muted-foreground">{feature}</td>
                    <td className="p-4 text-center">{free}</td>
                    <td className="p-4 text-center font-medium">{premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Free plan summary */}
        <motion.div className="rounded-[1.25rem] p-5" {...stagger(7)}>
          <h4 className="font-display italic text-base mb-3">{t('pricing.free_title')}</h4>
          <ul className="text-sm text-muted-foreground font-body space-y-2">
            <li className="flex items-start gap-2"><span className="text-muted-foreground/40 mt-0.5">·</span> {t('pricing.free_1')}</li>
            <li className="flex items-start gap-2"><span className="text-muted-foreground/40 mt-0.5">·</span> {t('pricing.free_2')}</li>
            <li className="flex items-start gap-2"><span className="text-muted-foreground/40 mt-0.5">·</span> {t('pricing.free_3')}</li>
          </ul>
        </motion.div>
      </div>
    </div>
    </>
  );
}
