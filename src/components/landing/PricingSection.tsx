import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Infinity, Brain, CalendarDays, BarChart3, Image, Sparkles, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { ComparisonTable } from './ComparisonTable';
import type { Locale } from '@/i18n/translations';

const FEATURES = [
  { icon: Infinity, label: 'landing.comp_garments', value: 'landing.comp_unlimited' },
  { icon: Sparkles, label: 'landing.comp_outfits', value: 'landing.comp_unlimited' },
  { icon: Brain, label: 'landing.comp_ai', value: 'landing.comp_advanced' },
  { icon: CalendarDays, label: 'landing.comp_calendar' },
  { icon: BarChart3, label: 'landing.comp_insights' },
  { icon: Image, label: 'landing.comp_flatlay' },
] as const;

export function PricingSection() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const pricing = getLocalizedPricing(locale as Locale);
  const [yearly, setYearly] = useState(true);

  const displayPrice = yearly ? pricing.yearlyMonthlyEquivalent : pricing.monthly;
  const billingNote = yearly
    ? `${pricing.yearly}${t('pricing.per_year')}`
    : null;

  return (
    <section id="pricing" className="px-6 py-20 md:py-32">
      <div className="max-w-xl mx-auto w-full">
        {/* Header */}
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 reveal-up">
          {t('landing.pricing_label')}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-4 text-foreground font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.pricing_title')}
        </h2>
        <p className="text-center text-muted-foreground text-sm mb-10 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.pricing_desc')}
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-10 reveal-up" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
          <span className={`text-sm transition-colors ${!yearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('pricing.monthly_label')}
          </span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 border ${
              yearly
                ? 'bg-primary/20 border-primary/30'
                : 'bg-white/[0.06] border-white/[0.06]'
            }`}
            role="switch"
            aria-checked={yearly}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-foreground transition-transform duration-300 ${yearly ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm transition-colors flex items-center gap-2 ${yearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('pricing.yearly_label')}
            {yearly && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20">
                -{pricing.savingsPercent}%
              </span>
            )}
          </span>
        </div>

        {/* Premium Card */}
        <div
          className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden reveal-scale"
          style={{
            '--reveal-delay': '200ms',
            boxShadow: '0 0 80px -20px hsl(var(--primary) / 0.12), inset 0 1px 0 0 rgba(255,255,255,0.04)',
          } as React.CSSProperties}
        >
          {/* Hero Trial Banner */}
          <div className="w-full py-3 px-6 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border-b border-amber-400/20">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-sm font-semibold tracking-wide text-amber-400">
              {t('trial.first_free')}
            </span>
          </div>

          <div className="p-8 md:p-10">
            <h3 className="text-sm tracking-[0.3em] uppercase text-muted-foreground font-medium mb-6">
              {t('landing.premium')}
            </h3>

            {/* Price */}
            <div className="mb-3">
              <span className="text-5xl md:text-6xl font-bold text-foreground font-space tracking-tight">
                {displayPrice}
              </span>
              <span className="text-muted-foreground text-sm ml-2">{t('pricing.per_month')}</span>
            </div>

            {/* Step-by-step pricing journey */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mb-8">
              <span className="text-amber-400 font-medium">{t('trial.first_free')}</span>
              <ArrowRight size={10} className="text-muted-foreground/40" />
              <span>
                {t('trial.then_prefix')} {billingNote || `${displayPrice}${t('pricing.per_month')}`}
              </span>
              {yearly && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20">
                  -{pricing.savingsPercent}%
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/[0.06] mb-8" />

            {/* Feature Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Icon size={15} strokeWidth={1.5} className="text-foreground/60 shrink-0" />
                  <span>{t(label as any)}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3.5 bg-foreground text-background rounded-full font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all duration-300"
            >
              {t('trial.start_button')}
              <ArrowRight size={15} strokeWidth={2} />
            </button>

            {/* Reassurance */}
            <p className="text-center text-muted-foreground/40 text-[11px] mt-3 tracking-wide">
              {t('trial.banner_desc')}
            </p>
          </div>
        </div>

        {/* Free footnote */}
        <p className="text-center text-muted-foreground/50 text-xs mt-6 reveal-up" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
          {t('landing.free_f1')} · {t('landing.free_f2')} · {t('landing.free_f3')}.{' '}
          <button onClick={() => navigate('/auth')} className="underline underline-offset-2 hover:text-foreground transition-colors">
            {t('landing.get_started')}
          </button>
        </p>

        {/* Comparison */}
        <div className="mt-8 text-center">
          <ComparisonTable />
        </div>
      </div>
    </section>
  );
}
