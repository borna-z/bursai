import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X, Sparkles, Shirt, Heart, Leaf, Shield, ArrowRight, Smartphone, Instagram, Twitter, Check, ChevronDown } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Enhanced IntersectionObserver: re-triggers on scroll back up
  useEffect(() => {
    const els = document.querySelectorAll('.reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .scroll-reveal, .line-grow, .word-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
          } else {
            e.target.classList.remove('visible');
          }
        });
      },
      { threshold: 0.08 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Parallax scroll listener
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty('--scroll-y', String(container.scrollTop));
          ticking = false;
        });
        ticking = true;
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Word reveal helper
  const WordReveal = ({ text, className = '' }: { text: string; className?: string }) => (
    <span className={`word-reveal ${className}`}>
      {text.split(' ').map((word, i, arr) => (
        <span key={i} style={{ transitionDelay: `${i * 80}ms`, marginRight: i < arr.length - 1 ? '0.3em' : 0 }}>
          {word}
        </span>
      ))}
    </span>
  );

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { id: 'how-it-works', label: t('landing.nav.how') },
    { id: 'sustainability', label: t('landing.nav.sustainability') },
    { id: 'pricing', label: t('landing.nav.pricing') },
    { id: 'download', label: t('landing.nav.download') },
  ];

  return (
    <>
      <Helmet>
        <title>{t('landing.title')}</title>
        <meta name="description" content={t('landing.meta')} />
      </Helmet>

      <div className="dark-landing" ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
        <div className="font-space selection:bg-white/10">

          {/* ── Header ── */}
          <header className="fixed top-0 w-full z-50 glass-panel border-b border-white/5">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
                <img src={bursLandingLogo} alt="BURS" className="h-6 object-contain" />
              </div>
              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors duration-300">{l.label}</button>
                ))}
              </nav>
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/auth')} className="hidden md:block bg-white text-[#030305] px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-all duration-300 hover:scale-105">
                  {t('landing.login')}
                </button>
                <button className="md:hidden text-gray-400 hover:text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>
                  {mobileOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="md:hidden border-t border-white/5 glass-panel animate-fade-in">
                <div className="flex flex-col gap-1 px-6 py-4 text-sm text-gray-400">
                  {navLinks.map(l => (
                    <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-white transition-colors">{l.label}</button>
                  ))}
                  <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-white text-[#030305] py-3 rounded-full text-center font-medium">{t('landing.login')}</button>
                </div>
              </div>
            )}
          </header>

          {/* ── SLIDE 1: Hero ── */}
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
            </div>

            {/* Scroll-down indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-gray-500">
              <span className="text-[10px] tracking-[0.3em] uppercase">{t('landing.scroll')}</span>
              <ChevronDown size={16} strokeWidth={1.5} className="chevron-pulse" />
            </div>
          </section>

          {/* ── SLIDE 2: Trial Banner ── */}
          <section className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 9, minHeight: '60vh' }}>
            <div className="max-w-3xl mx-auto w-full">
              <div className="relative overflow-hidden rounded-2xl glass-panel p-8 md:p-12 text-center border border-amber-400/20 reveal-scale" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                <p className="text-[10px] tracking-[0.4em] uppercase text-amber-400 mb-3 font-semibold reveal-down" style={{ '--reveal-delay': '150ms' } as React.CSSProperties}>{t('landing.limited_offer')}</p>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white font-space reveal-up" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                  {t('landing.trial_title')}
                </h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-6 reveal-up" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
                  {t('landing.trial_desc')}
                </p>
                <button onClick={() => navigate('/auth')} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white h-12 px-8 rounded-full text-sm font-semibold hover:opacity-90 transition-all hover:scale-105 reveal-scale" style={{ '--reveal-delay': '400ms' } as React.CSSProperties}>
                  {t('landing.start_trial')} <ArrowRight size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </section>

          {/* ── SLIDE 3: How It Works ── */}
          <section id="how-it-works" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 10 }}>
            <div className="max-w-4xl mx-auto w-full py-20">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.how_label')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                {t('landing.how_title')}
              </h2>
              <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

              {[
                { num: '01', icon: Shirt, title: t('landing.step1_title'), desc: t('landing.step1_desc') },
                { num: '02', icon: Sparkles, title: t('landing.step2_title'), desc: t('landing.step2_desc') },
                { num: '03', icon: Heart, title: t('landing.step3_title'), desc: t('landing.step3_desc') },
              ].map((s, i) => (
                <div key={s.num} className={`flex items-center gap-6 md:gap-10 py-10 border-t border-white/5 ${i % 2 === 0 ? 'reveal-left' : 'reveal-right'}`} style={{ '--reveal-delay': `${(i + 1) * 150}ms` } as React.CSSProperties}>
                  <span className="w-20 md:w-28 text-6xl md:text-7xl font-bold text-white/5 leading-none select-none shrink-0 font-space">{s.num}</span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <s.icon className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold tracking-tight text-white">{s.title}</h3>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SLIDE 4: Sustainability ── */}
          <section id="sustainability" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 11 }}>
            <div className="max-w-3xl mx-auto text-center w-full py-20">
              <div className="reveal-rotate" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
                <Leaf className="w-8 h-8 mx-auto mb-8 text-gray-500" strokeWidth={1} />
              </div>
              <blockquote className="text-2xl md:text-4xl font-bold tracking-tight leading-snug text-white font-space reveal-scale" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
                {t('landing.sust_quote')}
              </blockquote>
              <p className="mt-8 text-gray-400 text-sm max-w-lg mx-auto leading-relaxed reveal-up" style={{ '--reveal-delay': '250ms' } as React.CSSProperties}>
                {t('landing.sust_desc')}
              </p>

              <div className="mt-16 grid grid-cols-3 gap-px rounded-2xl overflow-hidden stagger-reveal">
                {[
                  { stat: '80%', label: t('landing.stat1') },
                  { stat: '92M', label: t('landing.stat2') },
                  { stat: '∞', label: t('landing.stat3') },
                ].map((s) => (
                  <div key={s.label} className="glass-panel p-6 md:p-10 reveal-up">
                    <div className="text-2xl md:text-3xl font-bold mb-2 text-white font-space">{s.stat}</div>
                    <div className="text-xs text-gray-500 tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SLIDE 5: Mission / Trust ── */}
          <section id="mission" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 12 }}>
            <div className="max-w-4xl mx-auto text-center w-full py-20">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.mission_label')}</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                {t('landing.mission_title')}
              </h2>
              <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

              <div className="grid md:grid-cols-3 gap-4 stagger-reveal">
                {[
                  { icon: Shield, title: t('landing.trust1_title'), desc: t('landing.trust1_desc') },
                  { icon: Shield, title: t('landing.trust2_title'), desc: t('landing.trust2_desc') },
                  { icon: Smartphone, title: t('landing.trust3_title'), desc: t('landing.trust3_desc') },
                ].map((item) => (
                  <div key={item.title} className="glass-panel rounded-2xl p-8 md:p-10 space-y-4 reveal-up tilt-card">
                    <item.icon className="w-5 h-5 mx-auto text-gray-500" strokeWidth={1.5} />
                    <h3 className="font-semibold tracking-tight text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SLIDE 6: Pricing ── */}
          <section id="pricing" className="section-full px-6 section-gradient-top section-gradient-bottom" style={{ zIndex: 13 }}>
            <div className="max-w-4xl mx-auto w-full py-20">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.pricing_label')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                {t('landing.pricing_title')}
              </h2>
              <p className="text-center text-gray-400 text-sm mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                {t('landing.pricing_desc')}
              </p>
              <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Free */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 flex flex-col reveal-left" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                  <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.free')}</h3>
                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-bold text-white font-space">{t('landing.free_price')}</span>
                    <span className="text-gray-500 text-sm ml-1">{t('landing.per_month')}</span>
                  </div>
                  <ul className="space-y-3 text-sm text-gray-400 flex-1">
                    {[t('landing.free_f1'), t('landing.free_f2'), t('landing.free_f3'), t('landing.free_f4')].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-white shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 border border-white/10 text-white rounded-full font-medium hover:bg-white/5 transition-colors duration-300 text-sm">
                    {t('landing.get_started')}
                  </button>
                </div>

                {/* Premium */}
                <div className="bg-white text-[#030305] rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden reveal-right" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
                  <div className="absolute top-4 right-4 bg-amber-400 text-[#030305] text-[10px] tracking-widest uppercase font-bold px-3 py-1 rounded-full reveal-scale" style={{ '--reveal-delay': '600ms' } as React.CSSProperties}>
                    {t('landing.premium_badge')}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight font-space">{t('landing.premium')}</h3>
                  <div className="mt-4 mb-2">
                    <span className="text-4xl font-bold font-space">{t('landing.premium_price')}</span>
                    <span className="text-[#030305]/60 text-sm ml-1">{t('landing.premium_for')}</span>
                  </div>
                  <p className="text-[#030305]/50 text-xs mb-6">{t('landing.premium_then')}</p>
                  <ul className="space-y-3 text-sm text-[#030305]/70 flex-1">
                    {[t('landing.premium_f1'), t('landing.premium_f2'), t('landing.premium_f3'), t('landing.premium_f4'), t('landing.premium_f5')].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-[#030305] shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => navigate('/auth')} className="mt-8 w-full py-3.5 bg-[#030305] text-white rounded-full font-medium hover:opacity-90 transition-all duration-300 text-sm hover:scale-[1.02]">
                    {t('landing.start_trial')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── SLIDE 7: Final CTA ── */}
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
                {t('landing.login')} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* ── SLIDE 8: Download ── */}
          <section id="download" className="section-full px-6 section-gradient-top" style={{ zIndex: 15 }}>
            <div className="max-w-4xl mx-auto w-full py-20">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 reveal-down" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>{t('landing.download_label')}</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space reveal-up" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
                {t('landing.download_title')}
              </h2>
              <p className="text-center text-gray-400 text-sm mb-4 reveal-up" style={{ '--reveal-delay': '120ms' } as React.CSSProperties}>
                {t('landing.download_desc')}
              </p>
              <div className="line-grow w-24 mx-auto mb-16" style={{ '--reveal-delay': '200ms' } as React.CSSProperties} />

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto stagger-reveal">
                {/* iPhone */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 reveal-up tilt-card">
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.iphone')}</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-gray-400">
                    {[
                      [t('landing.iphone_step1_pre'), t('landing.iphone_step1_bold'), t('landing.iphone_step1_post')],
                      [t('landing.iphone_step2_pre'), t('landing.iphone_step2_bold'), t('landing.iphone_step2_post')],
                      [t('landing.iphone_step3_pre'), t('landing.iphone_step3_bold'), t('landing.iphone_step3_post')],
                    ].map(([pre, strong, post], j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">{j + 1}</span>
                        <span>{pre}<strong className="text-white">{strong}</strong>{post}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Android */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 reveal-up tilt-card">
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight text-white font-space">{t('landing.android')}</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-gray-400">
                    {[
                      [t('landing.android_step1_pre'), t('landing.android_step1_bold'), t('landing.android_step1_post')],
                      [t('landing.android_step2_pre'), t('landing.android_step2_bold'), t('landing.android_step2_post')],
                      [t('landing.android_step3_pre'), t('landing.android_step3_bold'), t('landing.android_step3_post')],
                    ].map(([pre, strong, post], j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">{j + 1}</span>
                        <span>{pre}<strong className="text-white">{strong}</strong>{post}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="border-t border-white/5 px-6 py-10 reveal-up" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500 tracking-wide">
              <div className="flex items-center gap-2">
                <img src={bursLandingLogo} alt="BURS" className="h-5 object-contain" />
              </div>
              <div className="flex gap-6">
                <a href="/privacy" className="hover:text-white transition-colors">{t('landing.footer_privacy')}</a>
                <a href="/terms" className="hover:text-white transition-colors">{t('landing.footer_terms')}</a>
                <a href="/contact" className="hover:text-white transition-colors">{t('landing.footer_contact')}</a>
              </div>
              <div className="flex items-center gap-5">
                <a href="#" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
                <a href="#" aria-label="Twitter" className="hover:text-white transition-colors"><Twitter size={16} strokeWidth={1.5} /></a>
              </div>
              <div className="text-center md:text-right space-y-1">
                <span className="block text-gray-400">© {new Date().getFullYear()} BURS AB</span>
                <span className="block text-[10px] text-gray-600">{t('landing.footer_gdpr')}</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
