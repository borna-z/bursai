import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Shirt, Sparkles, Globe } from 'lucide-react';

export function SocialTicker() {
  const { t } = useLanguage();

  const items = [
    { icon: Users, text: t('landing.ticker_users'), glow: 'rgba(6,182,212,0.4)' },
    { icon: Shirt, text: t('landing.ticker_outfits'), glow: 'rgba(244,63,94,0.4)' },
    { icon: Sparkles, text: t('landing.ticker_garments'), glow: 'rgba(245,158,11,0.4)' },
    { icon: Globe, text: t('landing.ticker_countries'), glow: 'rgba(99,102,241,0.4)' },
  ];

  return (
    <section className="relative overflow-hidden py-6 border-y border-white/5" style={{ zIndex: 9 }}>
      <div className="ticker-track flex gap-16 whitespace-nowrap text-xs tracking-[0.3em] uppercase text-gray-400">
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3 shrink-0">
            <item.icon size={15} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${item.glow})`, color: 'rgba(255,255,255,0.6)' }} />
            {item.text}
            <span className="w-1 h-1 rounded-full bg-white/20 ml-1" aria-hidden="true" />
          </span>
        ))}
      </div>
    </section>
  );
}
