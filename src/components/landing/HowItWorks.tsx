import { Camera, Cpu, Repeat } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    {
      num: '01',
      icon: Camera,
      title: t('landing.step1_title'),
      desc: t('landing.step1_desc'),
      detail: t('landing.step1_detail'),
    },
    {
      num: '02',
      icon: Cpu,
      title: t('landing.step2_title'),
      desc: t('landing.step2_desc'),
      detail: t('landing.step2_detail'),
    },
    {
      num: '03',
      icon: Repeat,
      title: t('landing.step3_title'),
      desc: t('landing.step3_desc'),
      detail: t('landing.step3_detail'),
    },
  ];

  return (
    <section id="how-it-works" className="px-6 py-24 md:py-32 relative" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto w-full">
        <p
          className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down"
          style={{ '--reveal-delay': '0ms' } as React.CSSProperties}
        >
          {t('landing.how_label')}
        </p>
        <h2
          className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4 text-white font-space reveal-up"
          style={{ '--reveal-delay': '80ms' } as React.CSSProperties}
        >
          {t('landing.how_title')}
        </h2>
        <p
          className="text-center text-gray-400 text-sm max-w-lg mx-auto mb-4 reveal-up"
          style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
        >
          {t('landing.how_subtitle')}
        </p>
        <div
          className="line-grow w-24 mx-auto mb-20"
          style={{ '--reveal-delay': '200ms' } as React.CSSProperties}
        />

        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-white/0 via-white/10 to-white/0 hidden md:block" aria-hidden="true" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((s, i) => {
              const isEven = i % 2 === 0;
              return (
                <div
                  key={s.num}
                  className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 ${isEven ? '' : 'md:flex-row-reverse'} ${isEven ? 'reveal-left' : 'reveal-right'}`}
                  style={{ '--reveal-delay': `${i * 150}ms` } as React.CSSProperties}
                >
                  {/* Content */}
                  <div className={`flex-1 space-y-4 ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                    <div className={`flex items-center gap-3 ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                      <span className="text-5xl font-bold text-white/5 font-space select-none">{s.num}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-white font-space">
                      {s.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md">
                      {s.desc}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.detail}
                    </p>
                  </div>

                  {/* Center node */}
                  <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 backdrop-blur-sm">
                    <s.icon className="w-6 h-6 text-white/60" strokeWidth={1.5} />
                  </div>

                  {/* Spacer for the other side */}
                  <div className="flex-1 hidden md:block" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
