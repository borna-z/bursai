import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPricing } from '@/lib/localizedPricing';
import { ComparisonTable } from './ComparisonTable';
import type { Locale } from '@/i18n/translations';

export function PricingSection() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const pricing = getLocalizedPricing(locale as Locale);
  const [yearly, setYearly] = useState(true);

  return (
    <section id="pricing" className="px-6 py-20 md:py-32">
      <div className="max-w-4xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-up">
          {t('landing.pricing_label')}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.pricing_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm mb-10 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.pricing_desc')}
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12 reveal-up" style={{ '--reveal-delay': '160ms' } as React.CSSProperties}>
          <span className={`text-sm transition-colors ${!yearly ? 'text-white' : 'text-gray-500'}`}>{t('pricing.monthly_label')}</span>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${yearly ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-white/[0.06] border-white/[0.06]'} border`}
            role="switch"
            aria-checked={yearly}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 ${yearly ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm transition-colors flex items-center gap-2 ${yearly ? 'text-white' : 'text-gray-500'}`}>
            {t('pricing.yearly_label')}
            {yearly && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide text-amber-400 bg-amber-400/10 border border-amber-400/20">-{pricing.savingsPercent}%</span>}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 flex flex-col reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.free')}</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold text-white font-space">{t('landing.free_price')}</span>
              <span className="text-gray-500 text-sm ml-1">{t('landing.per_month')}</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 flex-1">
              {[t('landing.free_f1'), t('landing.free_f2'), t('landing.free_f3'), t('landing.free_f4')].map(f => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check size={14} strokeWidth={2} className="text-gray-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 rounded-full font-medium text-sm text-white border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300">
              {t('landing.get_started')}
            </button>
          </div>

          {/* Premium */}
          <div className="rounded-2xl bg-white text-[#030305] p-8 md:p-10 flex flex-col reveal-up relative" style={{ '--reveal-delay': '280ms' } as React.CSSProperties}>
            <span className="absolute top-4 right-4 text-[10px] tracking-widest uppercase font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              {t('landing.premium_badge')}
            </span>
            <h3 className="text-lg font-semibold tracking-tight font-space">{t('landing.premium')}</h3>
            <div className="mt-4 mb-2">
              <span className="text-4xl font-bold font-space">{t('landing.premium_price')}</span>
              <span className="text-[#030305]/50 text-sm ml-1">{t('landing.premium_for')}</span>
            </div>
            <p className="text-[#030305]/40 text-xs mb-6">
              {t('trial.then_prefix')} {yearly ? pricing.yearly + t('pricing.per_year') : pricing.monthly + t('pricing.per_month')}
              {yearly && ` · ${t('pricing.save')} ~${pricing.savingsPercent}%`}
            </p>
            <ul className="space-y-3 text-sm text-[#030305]/60 flex-1">
              {[t('landing.premium_f1'), t('landing.premium_f2'), t('landing.premium_f3'), t('landing.premium_f4'), t('landing.premium_f5')].map(f => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check size={14} strokeWidth={2} className="text-[#030305] shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 bg-[#030305] text-white rounded-full font-medium hover:opacity-90 transition-all duration-300 text-sm">
              {t('landing.start_trial')}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <ComparisonTable />
        </div>
      </div>
    </section>
  );
}
