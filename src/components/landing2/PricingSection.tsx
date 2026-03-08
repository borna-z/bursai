import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';

export function PricingSection() {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const pricing = getLocalizedPricing(locale);

  const FREE_FEATURES = ['Limited wardrobe capacity', 'Basic outfit building', 'Limited AI usage', 'Explore the system'];
  const PREMIUM_FEATURES = ['Unlimited wardrobe', 'Unlimited outfits', 'AI stylist access', 'Weekly planning', 'Full wardrobe system'];

  return (
    <section className="relative py-32 md:py-44 px-6" id="pricing">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>Pricing</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Simple pricing. More wardrobe value.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          Start free. Upgrade when you want the full system.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="lv2-card lv2-reveal lv2-reveal-delay-2 p-10">
          <h3 className="text-xl font-semibold mb-1" style={{ color: 'var(--lv2-text-primary)' }}>Free</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--lv2-text-tertiary)' }}>Get started</p>
          <div className="text-3xl font-bold mb-8" style={{ color: 'var(--lv2-text-primary)' }}>
            {pricing.currencySymbol === '£' ? '£0' : `0 ${pricing.currencySymbol}`}
          </div>
          <ul className="space-y-3 mb-8">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--lv2-text-secondary)' }}>
                <Check size={14} strokeWidth={2} style={{ color: 'var(--lv2-text-tertiary)' }} /> {f}
              </li>
            ))}
          </ul>
          <button onClick={() => navigate('/auth')} className="lv2-cta-ghost w-full py-3 rounded-full text-sm font-medium">
            Start Free
          </button>
        </div>

        {/* Premium */}
        <div className="lv2-card lv2-reveal lv2-reveal-delay-3 p-10 relative overflow-hidden" style={{ borderColor: 'rgba(30, 208, 231, 0.2)' }}>
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--lv2-cyan), transparent)' }} />
          {/* Premium glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top center, rgba(30,208,231,0.06) 0%, transparent 60%)' }} />

          <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] tracking-[0.15em] uppercase font-medium" style={{ background: 'rgba(30,208,231,0.12)', color: 'var(--lv2-cyan)' }}>
            Most Popular
          </div>
          <h3 className="text-xl font-semibold mb-1 relative" style={{ color: 'var(--lv2-text-primary)' }}>Premium</h3>
          <p className="text-sm mb-6 relative" style={{ color: 'var(--lv2-text-tertiary)' }}>Full system</p>
          <div className="mb-2 relative">
            <span className="text-3xl font-bold" style={{ color: 'var(--lv2-text-primary)' }}>{pricing.monthly}</span>
            <span className="text-sm ml-1" style={{ color: 'var(--lv2-text-tertiary)' }}>/month</span>
          </div>
          <p className="text-[11px] mb-8 relative" style={{ color: 'var(--lv2-text-tertiary)' }}>
            Billed monthly · Cancel anytime
          </p>
          <ul className="space-y-3 mb-8 relative">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--lv2-text-secondary)' }}>
                <Check size={14} strokeWidth={2} style={{ color: 'var(--lv2-cyan)' }} /> {f}
              </li>
            ))}
          </ul>
          <button onClick={() => navigate('/auth')} className="lv2-cta-primary w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2 relative">
            Go Premium <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
