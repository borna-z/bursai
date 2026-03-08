import { Leaf, Globe2, Recycle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function SustainabilitySection() {
  const { t } = useLanguage();

  return (
    <section id="sustainability" className="px-6 py-20 md:py-28 relative section-gradient-top section-gradient-bottom" style={{ zIndex: 11 }}>
      <div className="max-w-4xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left — Message */}
          <div className="text-center md:text-left">
            <div className="reveal-rotate" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
              <Leaf className="w-8 h-8 mb-6 text-emerald-400/60 mx-auto md:mx-0" strokeWidth={1} />
            </div>
            <blockquote className="text-2xl md:text-3xl font-bold tracking-tight leading-snug text-white font-space mb-6 reveal-scale" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              {t('landing.sust_quote')}
            </blockquote>
            <p className="text-gray-400 text-sm leading-relaxed reveal-up" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
              {t('landing.sust_desc')}
            </p>

            {/* Mission cards */}
            <div className="mt-8 space-y-4 reveal-up" style={{ '--reveal-delay': '350ms' } as React.CSSProperties}>
              {[
                { icon: Globe2, titleKey: 'landing.trust1_title', descKey: 'landing.trust1_desc' },
                { icon: Recycle, titleKey: 'landing.trust2_title', descKey: 'landing.trust2_desc' },
              ].map((item, i) => (
                <div key={i} className="glass-panel rounded-xl p-5 flex items-start gap-4">
                  <item.icon className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div>
                    <h4 className="text-sm font-medium text-white">{t(item.titleKey)}</h4>
                    <p className="text-xs text-gray-500 mt-1">{t(item.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Stats */}
          <div className="grid grid-cols-1 gap-px rounded-2xl overflow-hidden stagger-reveal">
            {[
              { stat: '80%', label: t('landing.stat1') },
              { stat: '92M', label: t('landing.stat2') },
              { stat: '∞', label: t('landing.stat3') },
            ].map((s) => (
              <div key={s.label} className="glass-panel p-8 text-center reveal-up">
                <div className="text-3xl md:text-4xl font-bold mb-2 text-white font-space">{s.stat}</div>
                <div className="text-xs text-gray-500 tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
