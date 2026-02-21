import { Shirt, Sparkles, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { num: '01', icon: Shirt, title: t('landing.step1_title'), desc: t('landing.step1_desc') },
    { num: '02', icon: Sparkles, title: t('landing.step2_title'), desc: t('landing.step2_desc') },
    { num: '03', icon: Heart, title: t('landing.step3_title'), desc: t('landing.step3_desc') },
  ];

  return (
    <section id="how-it-works" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 10 }}>
      <div className="max-w-4xl mx-auto w-full py-20">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.how_label')}</p>
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.how_title')}
        </h2>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        {steps.map((s, i) => (
          <div key={s.num} className={`flex items-center gap-6 md:gap-10 py-10 border-t border-white/5 ${i % 2 === 0 ? 'reveal-left' : 'reveal-right'}`} style={{ '--reveal-delay': `${(i + 1) * 150}ms` } as React.CSSProperties}>
            <span className="w-20 md:w-28 text-6xl md:text-7xl font-bold text-white/5 leading-none select-none shrink-0 font-space">{s.num}</span>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <s.icon className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold tracking-tight text-white">{s.title}</h3>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed max-w-md">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
