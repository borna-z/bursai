import { Sparkles, Leaf, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function MissionSection() {
  const { t } = useLanguage();

  const items = [
    { icon: Sparkles, title: t('landing.trust1_title'), desc: t('landing.trust1_desc') },
    { icon: Leaf, title: t('landing.trust2_title'), desc: t('landing.trust2_desc') },
    { icon: Calendar, title: t('landing.trust3_title'), desc: t('landing.trust3_desc') },
  ];

  return (
    <section id="mission" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 12 }}>
      <div className="max-w-4xl mx-auto text-center w-full py-20">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.mission_label')}</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.mission_title')}
        </h2>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        <div className="grid md:grid-cols-3 gap-4 stagger-reveal">
          {items.map((item) => (
            <div key={item.title} className="glass-panel rounded-2xl p-8 md:p-10 space-y-4 reveal-up tilt-card">
              <item.icon className="w-5 h-5 mx-auto text-gray-500" strokeWidth={1.5} />
              <h3 className="font-semibold tracking-tight text-white">{item.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
