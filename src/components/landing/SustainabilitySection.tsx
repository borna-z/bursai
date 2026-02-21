import { Leaf } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function SustainabilitySection() {
  const { t } = useLanguage();

  return (
    <section id="sustainability" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 11 }}>
      <div className="max-w-3xl mx-auto text-center w-full py-20">
        <div className="reveal-rotate" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <Leaf className="w-8 h-8 mx-auto mb-8 text-gray-500" strokeWidth={1} />
        </div>
        <blockquote className="text-2xl md:text-4xl font-bold tracking-tight leading-snug text-white font-space reveal-scale" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          {t('landing.sust_quote')}
        </blockquote>
        <p className="mt-8 text-gray-400 text-sm max-w-lg mx-auto leading-relaxed reveal-up" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
          {t('landing.sust_desc')}
        </p>

        <div className="mt-16 grid grid-cols-3 gap-px rounded-2xl overflow-hidden stagger-reveal">
          {[
            { stat: '80%', label: t('landing.stat1') },
            { stat: '92M', label: t('landing.stat2') },
            { stat: '∞', label: t('landing.stat3') },
          ].map((s) => (
            <div key={s.label} className="glass-panel p-6 md:p-10 reveal-up">
              <div className="text-2xl md:text-3xl font-bold mb-2 text-white font-space">{s.stat}</div>
              <div className="text-xs text-gray-500 tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
