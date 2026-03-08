import { Camera, Sparkles, CalendarDays, BarChart3, Shirt, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FEATURES = [
  { icon: Camera, key: 'snap', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/10' },
  { icon: Sparkles, key: 'ai_style', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/10' },
  { icon: CalendarDays, key: 'planner', gradient: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/10' },
  { icon: BarChart3, key: 'insights', gradient: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/10' },
  { icon: Shirt, key: 'outfits', gradient: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/10' },
  { icon: MessageSquare, key: 'chat', gradient: 'from-sky-500/20 to-indigo-500/20', border: 'border-sky-500/10' },
];

export function FeaturesShowcase() {
  const { t } = useLanguage();

  return (
    <section id="features" className="px-6 py-24 md:py-32 relative" style={{ zIndex: 10 }}>
      <div className="max-w-5xl mx-auto w-full">
        <p
          className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down"
          style={{ '--reveal-delay': '0ms' } as React.CSSProperties}
        >
          {t('landing.features_label')}
        </p>
        <h2
          className="text-3xl md:text-5xl font-bold text-center tracking-tight mb-4 text-white font-space reveal-up"
          style={{ '--reveal-delay': '80ms' } as React.CSSProperties}
        >
          {t('landing.features_title')}
        </h2>
        <p
          className="text-center text-gray-400 text-sm max-w-lg mx-auto mb-4 reveal-up"
          style={{ '--reveal-delay': '120ms' } as React.CSSProperties}
        >
          {t('landing.features_desc')}
        </p>
        <div
          className="line-grow w-24 mx-auto mb-16"
          style={{ '--reveal-delay': '200ms' } as React.CSSProperties}
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-reveal">
          {FEATURES.map((f, i) => (
            <div
              key={f.key}
              className={`group relative rounded-2xl border ${f.border} bg-gradient-to-br ${f.gradient} backdrop-blur-sm p-8 space-y-4 reveal-up tilt-card transition-all duration-500 hover:scale-[1.02]`}
              style={{ '--reveal-delay': `${i * 100}ms` } as React.CSSProperties}
            >
              {/* Glow accent */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10`} />

              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <f.icon className="w-5 h-5 text-white/70" strokeWidth={1.5} />
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
