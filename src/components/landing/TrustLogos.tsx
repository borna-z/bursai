import { useLanguage } from '@/contexts/LanguageContext';

const LOGOS = [
  { name: 'Vogue', color: 'rgba(244,63,94,0.5)' },
  { name: 'TechCrunch', color: 'rgba(34,197,94,0.5)' },
  { name: 'Wired', color: 'rgba(6,182,212,0.5)' },
  { name: 'Elle', color: 'rgba(245,158,11,0.5)' },
  { name: 'Forbes', color: 'rgba(99,102,241,0.5)' },
  { name: 'Fast Company', color: 'rgba(139,92,246,0.5)' },
];

export function TrustLogos() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-12 md:py-16 border-b border-white/5 relative" style={{ zIndex: 9 }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-white/10" />
          <p className="text-[10px] tracking-[0.4em] uppercase text-gray-600 text-center reveal-up">
            {t('landing.featured_in')}
          </p>
          <div className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-white/10" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {LOGOS.map((logo, i) => (
            <div
              key={logo.name}
              className="group relative text-gray-600 opacity-40 hover:opacity-90 transition-all duration-500 cursor-default reveal-scale"
              style={{ '--reveal-delay': `${i * 80}ms` } as React.CSSProperties}
            >
              <span className="text-lg md:text-xl font-bold tracking-tight font-space group-hover:text-white transition-colors duration-500">
                {logo.name}
              </span>
              <div
                className="absolute -bottom-2 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${logo.color}, transparent)` }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
