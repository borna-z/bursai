import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Shirt, Sparkles, Globe } from 'lucide-react';

export function SocialTicker() {
  const { t } = useLanguage();

  const items = [
    { icon: Users, text: t('landing.ticker_users') },
    { icon: Shirt, text: t('landing.ticker_outfits') },
    { icon: Sparkles, text: t('landing.ticker_garments') },
    { icon: Globe, text: t('landing.ticker_countries') },
  ];

  return (
    <section className="relative overflow-hidden py-5 border-y border-white/5" style={{ zIndex: 9 }}>
      <div className="ticker-track flex gap-12 whitespace-nowrap text-[11px] tracking-[0.25em] uppercase text-gray-500">
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3 shrink-0">
            <item.icon size={14} strokeWidth={1.5} className="text-gray-600" />
            {item.text}
          </span>
        ))}
      </div>
    </section>
  );
}
