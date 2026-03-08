import { Camera, Sparkles, CalendarDays, BarChart3, Shirt, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

const FEATURES = [
  { icon: Camera, key: 'snap', glow: 'rgba(59,130,246,0.25)', border: 'rgba(59,130,246,0.12)', accent: '#3b82f6' },
  { icon: Sparkles, key: 'ai_style', glow: 'rgba(245,158,11,0.25)', border: 'rgba(245,158,11,0.12)', accent: '#f59e0b' },
  { icon: CalendarDays, key: 'planner', glow: 'rgba(16,185,129,0.25)', border: 'rgba(16,185,129,0.12)', accent: '#10b981' },
  { icon: BarChart3, key: 'insights', glow: 'rgba(139,92,246,0.25)', border: 'rgba(139,92,246,0.12)', accent: '#8b5cf6' },
  { icon: Shirt, key: 'outfits', glow: 'rgba(244,63,94,0.25)', border: 'rgba(244,63,94,0.12)', accent: '#f43f5e' },
  { icon: MessageSquare, key: 'chat', glow: 'rgba(14,165,233,0.25)', border: 'rgba(14,165,233,0.12)', accent: '#0ea5e9' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

export function FeaturesShowcase() {
  const { t } = useLanguage();

  return (
    <section id="features" className="px-6 py-24 md:py-32 relative" style={{ zIndex: 10 }}>
      {/* Ambient floating orb */}
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', top: '20%', right: '-5%', animationDuration: '8s' }} aria-hidden="true" />

      <div className="max-w-6xl mx-auto w-full relative z-10">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          {t('landing.features_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4 text-white font-space text-shimmer reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.features_title')}
        </h2>
        <p className="text-center text-gray-400 text-sm max-w-lg mx-auto mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
          {t('landing.features_desc')}
        </p>
        <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.key}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-50px' }}
              variants={cardVariants}
              whileHover={{ scale: 1.03, y: -4 }}
              className="group relative hyper-glass rounded-2xl p-9 space-y-5 transition-all duration-500 overflow-hidden luminous-border"
              style={{ '--luminous-color': f.glow } as React.CSSProperties}
            >
              {/* Top glow line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${f.accent}60, transparent)` }} />

              <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300" style={{ background: `linear-gradient(135deg, ${f.border}, transparent)`, border: `1px solid ${f.border}`, boxShadow: `0 0 20px ${f.glow}` }}>
                <f.icon className="w-5 h-5 text-white/80 group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-white font-space">
                {t(`landing.feat_${f.key}_title`)}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t(`landing.feat_${f.key}_desc`)}
              </p>
              <p className="text-xs text-gray-500 italic">
                {t(`landing.feat_${f.key}_detail`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
