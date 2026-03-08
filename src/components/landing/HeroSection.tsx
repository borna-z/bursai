import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { lovable } from '@/integrations/lovable/index';

export function HeroSection() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleOAuth = async (provider: 'google' | 'apple') => {
    await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
  };

  return (
    <section
      id="main-content"
      role="banner"
      aria-label="Hero"
      className="relative w-full min-h-screen flex items-center overflow-hidden"
      style={{ zIndex: 8 }}
    >
      {/* Gradient mesh background */}
      <div className="gradient-mesh" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => {
          const size = 1 + (i % 3);
          const opacity = 0.03 + (i % 5) * 0.025;
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

      <div className="max-w-7xl mx-auto w-full px-6 md:px-12 grid md:grid-cols-2 gap-8 items-center pt-28 pb-20 relative z-10">
        {/* Left — Content */}
        <div className="flex flex-col gap-7 md:gap-9 text-center md:text-left">
          {/* Glowing badge */}
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full hyper-glass text-xs tracking-widest uppercase text-gray-300 w-fit mx-auto md:mx-0 reveal-scale visible" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
            <span className="w-2 h-2 rounded-full bg-indigo-400 dot-pulse" aria-hidden="true" />
            {t('landing.badge')}
          </div>

          {/* Massive shimmer headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tighter leading-[1.02] font-space text-shimmer reveal-up visible" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
            {t('landing.hero')}
          </h1>

          <p className="text-base sm:text-lg text-gray-400 font-light max-w-lg leading-relaxed tracking-wide mx-auto md:mx-0 reveal-up visible" style={{ '--reveal-delay': '50ms' } as React.CSSProperties}>
            {t('landing.hero_desc')}
          </p>

          {/* CTA — gradient border */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-2 reveal-scale visible" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
            <button
              onClick={() => navigate('/auth')}
              className="group relative w-full sm:w-auto px-10 py-4 bg-white text-[#030305] rounded-full font-semibold tracking-wide hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 30px rgba(99, 102, 241, 0.2), 0 0 60px rgba(99, 102, 241, 0.08)' }}
            >
              {t('landing.get_started')} <ArrowRight size={18} strokeWidth={2} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* SSO */}
          <div className="flex flex-col sm:flex-row items-center gap-3 reveal-up visible" style={{ '--reveal-delay': '150ms' } as React.CSSProperties}>
            <button onClick={() => handleOAuth('google')} className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-full hyper-glass text-sm text-gray-300 hover:text-white hover:border-white/15 transition-all duration-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              {t('auth.continue_google')}
            </button>
            <button onClick={() => handleOAuth('apple')} className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3 rounded-full hyper-glass text-sm text-gray-300 hover:text-white hover:border-white/15 transition-all duration-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              {t('auth.continue_apple')}
            </button>
          </div>

          {/* Live user badge */}
          <div className="flex items-center gap-3 reveal-up visible mx-auto md:mx-0" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0D0D0D] bg-gradient-to-br from-indigo-500/40 to-cyan-500/30" />
              ))}
            </div>
            <p className="text-xs text-gray-400 tracking-wide">
              <span className="text-white font-medium">12,500+</span> {t('landing.users_joined')}
            </p>
          </div>

          <p className="text-[11px] text-gray-600 tracking-wide reveal-up visible" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
            {t('landing.trust_line')}
          </p>
        </div>

        {/* Right — Animated orb cluster */}
        <div className="hidden md:flex relative h-[500px] lg:h-[600px] items-center justify-center reveal-scale visible" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
          <div className="glow-orb" style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)', top: '15%', left: '20%', animationDelay: '0s' }} />
          <div className="glow-orb" style={{ width: 250, height: 250, background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)', top: '35%', right: '10%', animationDelay: '-2s', animationDuration: '6s' }} />
          <div className="glow-orb" style={{ width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)', bottom: '15%', left: '30%', animationDelay: '-3.5s', animationDuration: '7s' }} />
        </div>
      </div>

      {/* Scroll line indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3 text-gray-500" aria-hidden="true">
        <span className="text-[10px] tracking-[0.3em] uppercase">{t('landing.scroll')}</span>
        <div className="scroll-line-pulse" />
      </div>
    </section>
  );
}
