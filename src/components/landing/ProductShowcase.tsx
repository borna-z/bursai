import { useLanguage } from '@/contexts/LanguageContext';
import screenshotWardrobe from '@/assets/screenshot-wardrobe.png';
import screenshotHome from '@/assets/screenshot-home.png';
import screenshotPlanner from '@/assets/screenshot-planner.png';

const SCREENS = [
  {
    src: screenshotWardrobe,
    altKey: 'landing.showcase_wardrobe_title',
    titleKey: 'landing.showcase_wardrobe_title',
    descKey: 'landing.showcase_wardrobe_desc',
  },
  {
    src: screenshotHome,
    altKey: 'landing.showcase_home_title',
    titleKey: 'landing.showcase_home_title',
    descKey: 'landing.showcase_home_desc',
  },
  {
    src: screenshotPlanner,
    altKey: 'landing.showcase_planner_title',
    titleKey: 'landing.showcase_planner_title',
    descKey: 'landing.showcase_planner_desc',
  },
];

export function ProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-up">
          {t('landing.product_label')}
        </p>
        <h2
          className="text-3xl md:text-5xl font-bold tracking-tight text-white font-space text-center mb-16 reveal-up"
          style={{ '--reveal-delay': '80ms' } as React.CSSProperties}
        >
          {t('landing.product_title')}
        </h2>

        {/* Phone trio + labels */}
        <div className="flex justify-center items-end gap-2 sm:gap-4 md:gap-8 mb-6">
          {SCREENS.map((screen, i) => {
            const isCenter = i === 1;
            const rotation = i === 0 ? '-rotate-3' : i === 2 ? 'rotate-3' : '';
            const size = isCenter ? 'phone-mockup phone-mockup-lg' : 'phone-mockup phone-mockup-sm';
            const opacity = isCenter ? '' : 'opacity-70';
            const translate = isCenter ? '' : 'translate-y-4';

            return (
              <div
                key={i}
                className={`${size} ${rotation} ${opacity} ${translate} ${isCenter ? 'relative z-10' : ''} reveal-up`}
                style={{ '--reveal-delay': `${i * 120 + 200}ms` } as React.CSSProperties}
              >
                <img
                  src={screen.src}
                  alt={t(screen.altKey)}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center 8%' }}
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>

        {/* Animated labels */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 max-w-3xl mx-auto text-center mt-10">
          {SCREENS.map((screen, i) => (
            <div
              key={i}
              className="reveal-up"
              style={{ '--reveal-delay': `${i * 100 + 500}ms` } as React.CSSProperties}
            >
              <div className="inline-flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-[11px] sm:text-[13px] font-semibold text-white tracking-wide">
                  {t(screen.titleKey)}
                </span>
                <span className="text-[10px] sm:text-[11px] text-gray-500 leading-snug hidden sm:block">
                  {t(screen.descKey)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
