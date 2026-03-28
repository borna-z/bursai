import { Camera, Sparkles, CalendarDays, BarChart3, Layers, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const FEATURES = [
  { icon: Camera, key: 'snap' },
  { icon: Sparkles, key: 'ai_stylist' },
  { icon: CalendarDays, key: 'planner' },
  { icon: BarChart3, key: 'insights_feat' },
  { icon: Layers, key: 'outfits_feat' },
  { icon: MessageCircle, key: 'chat_feat' },
];

export function BentoGrid() {
  const { t } = useLanguage();

  return (
    <section id="features" className="px-6 py-20 md:py-32">
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-up">
          {t('landing.nav.features')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight text-white font-space mb-16 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.features_title')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.key}
                className="rounded-[1.25rem] border border-white/[0.06] bg-white/[0.02] p-7 hover:bg-white/[0.04] hover:-translate-y-1 transition-all duration-300 reveal-up"
                style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}
              >
                <Icon size={20} strokeWidth={1.5} className="text-indigo-400 mb-4" />
                <h3 className="text-sm font-semibold text-white font-space mb-1.5">
                  {t(`landing.bento_${feat.key}_title`)}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {t(`landing.bento_${feat.key}_desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
