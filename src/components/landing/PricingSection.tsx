import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function PricingSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section id="pricing" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 13 }}>
      <div className="max-w-4xl mx-auto w-full py-20">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.pricing_label')}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.pricing_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.pricing_desc')}
        </p>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <div className="glass-panel rounded-2xl p-8 md:p-10 flex flex-col reveal-left" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.free')}</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold text-white font-space">{t('landing.free_price')}</span>
              <span className="text-gray-500 text-sm ml-1">{t('landing.per_month')}</span>
            </div>
            <ul className="space-y-3 text-sm text-gray-400 flex-1">
              {[t('landing.free_f1'), t('landing.free_f2'), t('landing.free_f3'), t('landing.free_f4')].map(f => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check size={14} strokeWidth={2} className="text-white shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 border border-white/10 text-white rounded-full font-medium hover:bg-white/5 transition-colors duration-300 text-sm">
              {t('landing.get_started')}
            </button>
          </div>

          {/* Premium */}
          <div className="bg-white text-[#030305] rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden reveal-right" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            <div className="absolute top-4 right-4 bg-amber-400 text-[#030305] text-[10px] tracking-widest uppercase font-bold px-3 py-1 rounded-full reveal-scale" style={{ '--reveal-delay': '600ms' } as React.CSSProperties}>
              {t('landing.premium_badge')}
            </div>
            <h3 className="text-lg font-semibold tracking-tight font-space">{t('landing.premium')}</h3>
            <div className="mt-4 mb-2">
              <span className="text-4xl font-bold font-space">{t('landing.premium_price')}</span>
              <span className="text-[#030305]/60 text-sm ml-1">{t('landing.premium_for')}</span>
            </div>
            <p className="text-[#030305]/50 text-xs mb-6">{t('landing.premium_then')}</p>
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
    </section>
  );
}
