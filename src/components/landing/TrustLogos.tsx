import { useLanguage } from '@/contexts/LanguageContext';

const LOGOS = [
  { name: 'Vogue', letter: 'V' },
  { name: 'TechCrunch', letter: 'TC' },
  { name: 'Wired', letter: 'W' },
  { name: 'Elle', letter: 'E' },
  { name: 'Forbes', letter: 'F' },
  { name: 'Fast Company', letter: 'FC' },
];

export function TrustLogos() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-10 md:py-14 border-b border-white/5 relative" style={{ zIndex: 9 }}>
      <div className="max-w-5xl mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-600 text-center mb-8 reveal-up">
          {t('landing.featured_in')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
          {LOGOS.map((logo) => (
            <div
              key={logo.name}
              className="group flex items-center gap-2 text-gray-600 grayscale opacity-40 hover:opacity-80 hover:grayscale-0 transition-all duration-500 cursor-default reveal-scale"
            >
              <span className="text-lg md:text-xl font-bold tracking-tight font-space group-hover:text-white transition-colors duration-500">
                {logo.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
