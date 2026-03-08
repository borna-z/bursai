import { useLanguage } from '@/contexts/LanguageContext';
import appScreenshot from '@/assets/app-screenshot-home.png';

export function ProductShowcase() {
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20 md:py-32 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 reveal-up">
          {t('landing.product_label')}
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-space mb-16 reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.product_title')}
        </h2>

        <div className="flex justify-center items-end gap-4 md:gap-8 reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          {/* Left phone — rotated */}
          <div className="phone-mockup phone-mockup-sm hidden sm:block -rotate-3 opacity-70 translate-y-4">
            <img src={appScreenshot} alt="BURS wardrobe view" className="w-full h-full object-cover object-top" loading="lazy" />
          </div>

          {/* Center phone — hero */}
          <div className="phone-mockup phone-mockup-lg relative z-10">
            <img src={appScreenshot} alt="BURS home screen" className="w-full h-full object-cover object-top" loading="lazy" />
          </div>

          {/* Right phone — rotated */}
          <div className="phone-mockup phone-mockup-sm hidden sm:block rotate-3 opacity-70 translate-y-4">
            <img src={appScreenshot} alt="BURS AI stylist" className="w-full h-full object-cover object-top" loading="lazy" />
          </div>
        </div>
      </div>
    </section>
  );
}
