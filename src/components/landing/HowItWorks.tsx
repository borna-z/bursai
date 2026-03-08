import { Camera, Sparkles, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

const STEP_COLORS = [
  { glow: 'rgba(59,130,246,0.3)', border: 'rgba(59,130,246,0.15)' },
  { glow: 'rgba(245,158,11,0.3)', border: 'rgba(245,158,11,0.15)' },
  { glow: 'rgba(16,185,129,0.3)', border: 'rgba(16,185,129,0.15)' },
];

const stepVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

export function HowItWorks() {
  const { t } = useLanguage();

  const steps = [
    { icon: Camera, num: '01', title: t('landing.step1_title'), desc: t('landing.step1_desc'), detail: t('landing.step1_detail') },
    { icon: Sparkles, num: '02', title: t('landing.step2_title'), desc: t('landing.step2_desc'), detail: t('landing.step2_detail') },
    { icon: CalendarDays, num: '03', title: t('landing.step3_title'), desc: t('landing.step3_desc'), detail: t('landing.step3_detail') },
  ];

  return (
    <section id="how-it-works" className="px-6 py-24 md:py-32 relative section-gradient-top" style={{ zIndex: 9 }}>
      <div className="max-w-5xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          {t('landing.how_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4 text-white font-space text-shimmer reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.how_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm max-w-lg mx-auto mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.how_subtitle')}
        </p>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        <div className="relative">
          {/* Gradient vertical connector */}
          <div className="absolute left-8 md:left-1/2 md:-translate-x-px top-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(6,182,212,0.3), rgba(16,185,129,0.3))' }} aria-hidden="true" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={stepVariants}
                className={`relative flex flex-col md:flex-row items-start gap-8 ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Number node with glow ring */}
                <div className="absolute left-8 md:left-1/2 -translate-x-1/2 z-10">
                  <div className="w-10 h-10 rounded-full bg-[#030305] border border-white/10 flex items-center justify-center" style={{ boxShadow: `0 0 20px ${STEP_COLORS[i].glow}` }}>
                    <span className="text-xs font-bold text-white font-space">{step.num}</span>
                  </div>
                </div>

                {/* Content — hyper-glass card */}
                <div className={`ml-20 md:ml-0 md:w-[45%] ${i % 2 !== 0 ? 'md:text-right' : ''}`}>
                  <div
                    className="hyper-glass rounded-2xl p-8 space-y-4 group transition-all duration-500 relative overflow-hidden"
                    style={{ '--luminous-color': STEP_COLORS[i].glow } as React.CSSProperties}
                  >
                    {/* Colored top edge glow */}
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${STEP_COLORS[i].border}, transparent)` }} />
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${i % 2 !== 0 ? 'md:ml-auto' : ''}`} style={{ background: `linear-gradient(135deg, ${STEP_COLORS[i].border}, transparent)`, border: `1px solid ${STEP_COLORS[i].border}` }}>
                      <step.icon className="w-5 h-5 text-white/80" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-semibold tracking-tight text-white font-space">{step.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                    <p className="text-xs text-gray-500 italic">{step.detail}</p>
                  </div>
                </div>

                <div className="hidden md:block md:w-[45%]" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
