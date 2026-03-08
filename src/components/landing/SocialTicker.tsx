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
    <section className="relative overflow-hidden py-5 border-y border-white/[0.04]">
      <div className="ticker-track flex gap-20 whitespace-nowrap text-[11px] tracking-[0.25em] uppercase text-gray-500">
        {[...items, ...items, ...items].map((text, i) => (
          <span key={i} className="flex items-center gap-6 shrink-0">
            {text}
            <span className="w-1 h-1 rounded-full bg-white/10" aria-hidden="true" />
          </span>
        ))}
      </div>
    </section>
  );
}
