import { Camera, Sparkles, CalendarDays, BarChart3, Shirt, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';

const FEATURES = [
  { icon: Camera, key: 'snap', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/10', accent: '#3b82f6' },
  { icon: Sparkles, key: 'ai_style', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/10', accent: '#f59e0b' },
  { icon: CalendarDays, key: 'planner', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/10', accent: '#10b981' },
  { icon: BarChart3, key: 'insights', gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/10', accent: '#8b5cf6' },
  { icon: Shirt, key: 'outfits', gradient: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/10', accent: '#f43f5e' },
  { icon: MessageSquare, key: 'chat', gradient: 'from-sky-500/20 to-indigo-500/20', border: 'border-sky-500/10', accent: '#0ea5e9' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function FeaturesShowcase() {
  const { t } = useLanguage();

  return (
    <section id="features" className="px-6 py-24 md:py-32 relative" style={{ zIndex: 10 }}>
      <div className="max-w-6xl mx-auto w-full">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          {t('landing.features_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
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
              className={`group relative rounded-2xl border ${f.border} bg-gradient-to-br ${f.gradient} backdrop-blur-sm p-8 space-y-4 transition-shadow duration-500 hover:shadow-[0_0_40px_-10px_${f.accent}30]`}
            >
              {/* Top glow line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-colors duration-300">
                <f.icon className="w-5 h-5 text-white/70 group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
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
