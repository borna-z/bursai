import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export function CTASection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="section-full px-6 relative section-gradient-top" style={{ zIndex: 14 }}>
      <div className="aurora-glow" />
      <div className="max-w-lg mx-auto text-center space-y-8 relative z-10">
        <img src={bursLandingLogo} alt="BURS" className="h-10 mx-auto reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties} />
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-space reveal-up" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          {t('landing.cta_title')}
        </h2>
        <p className="text-gray-400 text-sm tracking-wide reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          {t('landing.cta_desc')}
        </p>
        <button onClick={() => navigate('/auth')} className="inline-flex items-center gap-2 bg-white text-[#030305] h-14 px-12 rounded-full text-sm font-semibold tracking-widest uppercase hover:opacity-90 transition-all hover:scale-105 glow-pulse reveal-scale" style={{ '--reveal-delay': '350ms' } as React.CSSProperties}>
          {t('landing.get_started')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
