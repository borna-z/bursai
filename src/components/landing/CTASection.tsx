import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export function CTASection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="px-6 py-20 md:py-28 relative overflow-hidden" style={{ zIndex: 14 }} aria-label="Call to action">
      {/* Full gradient mesh */}
      <div className="gradient-mesh" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="max-w-lg mx-auto text-center space-y-8 relative z-10">
        <div className="reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)', boxShadow: '0 0 30px rgba(245,158,11,0.12)' }}>
            <Sparkles className="w-6 h-6 text-amber-400/80" strokeWidth={1.5} />
          </div>
        </div>
        <img src={bursLandingLogo} alt="BURS" className="h-10 mx-auto reveal-scale" style={{ '--reveal-delay': '50ms' } as React.CSSProperties} />
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-space text-shimmer reveal-up" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          {t('landing.cta_title')}
        </h2>
        <p className="text-gray-400 text-sm tracking-wide reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          {t('landing.cta_desc')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 reveal-scale" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
          <button
            onClick={() => navigate('/auth')}
            className="group inline-flex items-center gap-2 bg-white text-[#030305] h-14 px-12 rounded-full text-sm font-semibold tracking-widest uppercase hover:opacity-90 transition-all hover:scale-105"
            style={{ boxShadow: '0 0 30px rgba(99,102,241,0.2), 0 0 60px rgba(99,102,241,0.08)' }}
          >
            {t('landing.get_started')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <p className="text-xs text-gray-600 reveal-up" style={{ '--reveal-delay': '400ms' } as React.CSSProperties}>
          {t('landing.urgency_counter')}
        </p>
      </div>
    </section>
  );
}
