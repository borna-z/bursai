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
      className="relative w-full min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Soft radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center pt-28 pb-20">
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[6rem] font-bold tracking-[-0.04em] leading-[0.92] text-white font-space reveal-up visible">
          {t('landing.hero')}
        </h1>

        <p className="mt-6 text-base sm:text-lg text-gray-400 font-light max-w-lg mx-auto leading-relaxed tracking-wide reveal-up visible" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
          {t('landing.hero_desc')}
        </p>

        {/* Primary CTA */}
        <div className="mt-10 reveal-up visible" style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
          <button
            onClick={() => navigate('/auth')}
            className="group px-10 py-4 bg-white text-[#030305] rounded-full font-semibold tracking-wide hover:scale-[1.03] transition-transform duration-300 inline-flex items-center gap-2.5 text-sm"
          >
            {t('landing.get_started')}
            <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* SSO */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3 reveal-up visible" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
          <button onClick={() => handleOAuth('google')} className="w-full sm:w-auto flex items-center justify-center gap-3 px-5 py-2.5 rounded-full text-sm text-gray-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t('auth.continue_google')}
          </button>
          <button onClick={() => handleOAuth('apple')} className="w-full sm:w-auto flex items-center justify-center gap-3 px-5 py-2.5 rounded-full text-sm text-gray-400 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            {t('auth.continue_apple')}
          </button>
        </div>
      </div>
    </section>
  );
}
