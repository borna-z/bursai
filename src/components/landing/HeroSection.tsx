import { useNavigate } from 'react-router-dom';
import { ArrowRight, Smartphone, ChevronDown, Shirt, Sparkles, Heart } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export function HeroSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="section-full relative w-full px-6 md:px-12 pt-20 section-gradient-bottom" style={{ zIndex: 8 }}>
      <div className="aurora-glow" />

      {/* Star-field particles */}
      <div className="particles">
        {Array.from({ length: 22 }).map((_, i) => {
          const size = 1 + (i % 3);
          const opacity = 0.04 + (i % 5) * 0.03;
          return (
            <div key={i} className="particle" style={{
              width: size, height: size,
              top: `${(i * 37) % 100}%`, left: `${(i * 53 + 11) % 100}%`,
              '--particle-opacity': opacity,
              '--tw-dur': `${3 + (i % 4) * 1.5}s`,
              '--dr-dur': `${8 + (i % 5) * 3}s`,
              '--delay': `${(i * 0.4) % 4}s`,
            } as React.CSSProperties} />
          );
        })}
      </div>

      {/* Parallax decorative shapes */}
      <div className="absolute top-1/4 left-[12%] w-24 h-px bg-white/5 parallax-slow rotate-45" />
      <div className="absolute top-1/3 right-[15%] w-3 h-3 rounded-full border border-white/5 parallax-fast" />
      <div className="absolute bottom-1/3 left-[30%] w-1.5 h-1.5 rounded-full bg-white/10 parallax-slow" />

      <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center gap-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs tracking-wide text-gray-400 backdrop-blur-sm reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {t('landing.badge')}
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] font-space reveal-up gradient-shift-text" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          {t('landing.hero')}
        </h1>

        <p className="text-lg md:text-xl text-gray-400 font-light max-w-lg leading-relaxed reveal-up" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
          {t('landing.hero_desc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4 reveal-scale" style={{ '--reveal-delay': '400ms' } as React.CSSProperties}>
          <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-8 py-4 bg-white text-[#030305] rounded-full font-medium hover:scale-105 transition-transform duration-300 flex items-center justify-center gap-2">
            {t('landing.get_started')} <ArrowRight size={18} strokeWidth={2} />
          </button>
          <button onClick={() => scrollTo('how-it-works')} className="w-full sm:w-auto px-8 py-4 border border-white/10 text-white rounded-full font-medium hover:bg-white/5 transition-colors duration-300 flex items-center justify-center gap-2 glass-panel">
            <Smartphone size={18} strokeWidth={1.5} /> {t('landing.explore')}
          </button>
        </div>

        <p className="text-xs text-gray-500 tracking-wide reveal-up" style={{ '--reveal-delay': '550ms' } as React.CSSProperties}>
          {t('landing.trust_line')}
        </p>
      </div>

      {/* Scroll-down indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-gray-500">
        <span className="text-[10px] tracking-[0.3em] uppercase">{t('landing.scroll')}</span>
        <ChevronDown size={16} strokeWidth={1.5} className="chevron-pulse" />
      </div>
    </section>
  );
}
