import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { HeroSection } from '@/components/landing/HeroSection';

// Lazy-load below-fold sections for faster initial paint
const TrialBanner = lazy(() => import('@/components/landing/TrialBanner').then(m => ({ default: m.TrialBanner })));
const HowItWorks = lazy(() => import('@/components/landing/HowItWorks').then(m => ({ default: m.HowItWorks })));
const SustainabilitySection = lazy(() => import('@/components/landing/SustainabilitySection').then(m => ({ default: m.SustainabilitySection })));
const MissionSection = lazy(() => import('@/components/landing/MissionSection').then(m => ({ default: m.MissionSection })));
const PricingSection = lazy(() => import('@/components/landing/PricingSection').then(m => ({ default: m.PricingSection })));
const CTASection = lazy(() => import('@/components/landing/CTASection').then(m => ({ default: m.CTASection })));
const DownloadSection = lazy(() => import('@/components/landing/DownloadSection').then(m => ({ default: m.DownloadSection })));
const LandingFooter = lazy(() => import('@/components/landing/LandingFooter').then(m => ({ default: m.LandingFooter })));

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

  // Re-observe elements after lazy sections mount
  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 200);
    return () => clearTimeout(timer);
  });

  return (
    <>
      <Helmet>
        <title>{t('landing.title')}</title>
        <meta name="description" content={t('landing.meta')} />
        <meta property="og:title" content="BURS | Your Personal Stylist" />
        <meta property="og:description" content="Upload your closet. Let BURS style you. Save the planet by wearing what you already own." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://burs.me" />
        <meta property="og:image" content="https://burs.me/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BURS | Your Personal Stylist" />
        <meta name="twitter:description" content="Upload your closet. Let BURS style you. Save the planet by wearing what you already own." />
        <meta name="twitter:image" content="https://burs.me/og-image.png" />
      </Helmet>

      <div className="dark-landing" ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
        <div className="font-space selection:bg-white/10">

          {/* ── Header ── */}
          <header className="fixed top-0 w-full z-50 glass-panel border-b border-white/5" role="navigation" aria-label="Main navigation">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} role="button" aria-label="Scroll to top">
                <img src={bursLandingLogo} alt="BURS home" className="h-6 object-contain" width={80} height={24} loading="eager" fetchPriority="high" />
              </div>
              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400" aria-label="Page sections">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{l.label}</button>
                ))}
              </nav>
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/auth')} className="hidden md:block bg-white text-[#030305] px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-all duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  {t('landing.login')}
                </button>
                <button className="md:hidden text-gray-400 hover:text-white p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
                  {mobileOpen ? <X size={24} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={24} strokeWidth={1.5} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="md:hidden border-t border-white/5 glass-panel animate-fade-in" role="menu">
                <div className="flex flex-col gap-1 px-6 py-4 text-sm text-gray-400">
                  {navLinks.map(l => (
                    <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" role="menuitem">{l.label}</button>
                  ))}
                  <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-white text-[#030305] py-3 rounded-full text-center font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" role="menuitem">{t('landing.login')}</button>
                </div>
              </div>
            )}
          </header>

          {/* Hero loads eagerly */}
          <HeroSection />

          {/* Below-fold sections lazy-loaded with min-height to prevent CLS */}
          <Suspense fallback={<div style={{ minHeight: '400vh' }} aria-hidden="true" />}>
            <TrialBanner />
            <HowItWorks />
            <SustainabilitySection />
            <MissionSection />
            <PricingSection />
            <CTASection />
            <DownloadSection />
            <LandingFooter />
          </Suspense>
        </div>
      </div>
    </>
  );
}
