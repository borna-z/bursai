import { useLanguage } from '@/contexts/LanguageContext';

export function SocialTicker() {
  const { t } = useLanguage();

  const items = [
    t('landing.ticker_users'),
    t('landing.ticker_outfits'),
    t('landing.ticker_garments'),
    t('landing.ticker_countries'),
  ];

  return (
    <section className="relative overflow-hidden py-6 border-y border-white/5" style={{ zIndex: 9 }}>
      <div className="ticker-track flex gap-16 whitespace-nowrap text-xs tracking-[0.3em] uppercase text-gray-500">
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3 shrink-0">
            <span className="w-1 h-1 rounded-full bg-white/20" />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
