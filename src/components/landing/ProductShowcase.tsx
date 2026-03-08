import { useLanguage } from '@/contexts/LanguageContext';
import screenshotWardrobe from '@/assets/screenshot-wardrobe.png';
import screenshotHome from '@/assets/screenshot-home.png';
import screenshotStylist from '@/assets/screenshot-stylist.png';

const SCREENS = [
  { src: screenshotWardrobe, altKey: 'landing.showcase_wardrobe', labelKey: 'landing.showcase_wardrobe_label' },
  { src: screenshotHome, altKey: 'landing.showcase_home', labelKey: 'landing.showcase_home_label' },
  { src: screenshotStylist, altKey: 'landing.showcase_chat', labelKey: 'landing.showcase_chat_label' },
];

export function ProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-up">
          {t('landing.product_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-space text-center mb-16 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.product_title')}
        </h2>

        {/* Phone trio */}
        <div className="flex justify-center items-end gap-4 md:gap-8 mb-14">
          {SCREENS.map((screen, i) => {
            const isCenter = i === 1;
            const rotation = i === 0 ? '-rotate-3' : i === 2 ? 'rotate-3' : '';
            const size = isCenter ? 'phone-mockup phone-mockup-lg' : 'phone-mockup phone-mockup-sm';
            const opacity = isCenter ? '' : 'opacity-70';
            const translate = isCenter ? '' : 'translate-y-4';
            const hide = isCenter ? '' : 'hidden sm:block';

            return (
              <div
                key={i}
                className={`${size} ${rotation} ${opacity} ${translate} ${hide} ${isCenter ? 'relative z-10' : ''} reveal-up`}
                style={{ '--reveal-delay': `${i * 120 + 200}ms` } as React.CSSProperties}
              >
                <img
                  src={screen.src}
                  alt={t(screen.altKey)}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>

        {/* Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto text-center">
          {SCREENS.map((screen, i) => (
            <p key={i} className="text-xs text-gray-500 tracking-wide reveal-up" style={{ '--reveal-delay': `${i * 80 + 400}ms` } as React.CSSProperties}>
              {t(screen.labelKey)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
