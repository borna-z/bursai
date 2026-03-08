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
    <section id="pricing" className="px-6 py-20 md:py-32 relative section-gradient-top section-gradient-bottom" style={{ zIndex: 13 }}>
      <div className="max-w-4xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          {t('landing.pricing_label')}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space text-shimmer reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.pricing_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.pricing_desc')}
        </p>
        <div className="line-grow w-24 mx-auto mb-10" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        {/* Toggle with glow */}
        <div className="flex items-center justify-center gap-4 mb-12 reveal-scale" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
          <span className={`text-sm transition-colors ${!yearly ? 'text-white' : 'text-gray-500'}`}>{t('pricing.monthly_label')}</span>
          <button
            onClick={() => setYearly(!yearly)}
            className="relative w-14 h-7 rounded-full transition-all duration-300"
            style={{
              background: yearly ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${yearly ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: yearly ? '0 0 15px rgba(99,102,241,0.2)' : 'none',
            }}
            role="switch"
            aria-checked={yearly}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform duration-300 ${yearly ? 'translate-x-7' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm transition-colors flex items-center gap-2 ${yearly ? 'text-white' : 'text-gray-500'}`}>
            {t('pricing.yearly_label')}
            {yearly && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 10px rgba(245,158,11,0.15)' }}>-{pricing.savingsPercent}%</span>}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free — hyper-glass */}
          <div className="hyper-glass rounded-2xl p-8 md:p-10 flex flex-col luminous-border reveal-left" style={{ '--reveal-delay': '200ms', '--luminous-color': 'rgba(255,255,255,0.08)' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.free')}</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold gradient-text font-space">{t('landing.free_price')}</span>
              <span className="text-gray-500 text-sm ml-1">{t('landing.per_month')}</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 flex-1">
              {[t('landing.free_f1'), t('landing.free_f2'), t('landing.free_f3'), t('landing.free_f4')].map(f => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check size={14} strokeWidth={2} className="text-white shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 rounded-full font-medium text-sm text-white transition-all duration-300 hover:scale-[1.02] hyper-glass luminous-border" style={{ '--luminous-color': 'rgba(255,255,255,0.1)' } as React.CSSProperties}>
              {t('landing.get_started')}
            </button>
          </div>

          {/* Premium — animated gradient border */}
          <div className="relative rounded-2xl flex flex-col reveal-right overflow-hidden" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            {/* Animated border */}
            <div className="gradient-border-animated absolute inset-0 rounded-2xl pointer-events-none" style={{ zIndex: 1 }}>
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'conic-gradient(from 0deg, rgba(99,102,241,0.5), rgba(6,182,212,0.5), rgba(245,158,11,0.4), rgba(99,102,241,0.5))', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: 1, animation: 'border-spin 4s linear infinite' }} />
            </div>

            <div className="bg-white text-[#030305] rounded-2xl p-8 md:p-10 flex flex-col relative z-10 h-full">
              <div className="absolute top-4 right-4 text-[10px] tracking-widest uppercase font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 12px rgba(245,158,11,0.2)', animation: 'orb-pulse 3s ease-in-out infinite' }}>
                {t('landing.premium_badge')}
              </div>
              <h3 className="text-lg font-semibold tracking-tight font-space">{t('landing.premium')}</h3>
              <div className="mt-4 mb-2">
                <span className="text-4xl font-bold font-space">{t('landing.premium_price')}</span>
                <span className="text-[#030305]/60 text-sm ml-1">{t('landing.premium_for')}</span>
              </div>
              <p className="text-[#030305]/50 text-xs mb-6">
                {t('trial.then_prefix')} {yearly ? pricing.yearly + t('pricing.per_year') : pricing.monthly + t('pricing.per_month')}
                {yearly && ` · ${t('pricing.save')} ~${pricing.savingsPercent}%`}
              </p>
              <ul className="space-y-3 text-sm text-[#030305]/70 flex-1">
                {[t('landing.premium_f1'), t('landing.premium_f2'), t('landing.premium_f3'), t('landing.premium_f4'), t('landing.premium_f5')].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check size={14} strokeWidth={2} className="text-[#030305] shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 bg-[#030305] text-white rounded-full font-medium hover:opacity-90 transition-all duration-300 text-sm hover:scale-[1.02]">
                {t('landing.start_trial')}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <ComparisonTable />
        </div>
      </div>
    </section>
  );
}
