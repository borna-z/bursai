import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { HeroSection } from '@/components/landing/HeroSection';
import { CookieConsent } from '@/components/landing/CookieConsent';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { LanguageSwitcher } from '@/components/landing/LanguageSwitcher';

// Lazy-load below-fold sections
const SocialTicker = lazy(() => import('@/components/landing/SocialTicker').then(m => ({ default: m.SocialTicker })));
const TrustLogos = lazy(() => import('@/components/landing/TrustLogos').then(m => ({ default: m.TrustLogos })));
const HowItWorks = lazy(() => import('@/components/landing/HowItWorks').then(m => ({ default: m.HowItWorks })));
const FeaturesShowcase = lazy(() => import('@/components/landing/FeaturesShowcase').then(m => ({ default: m.FeaturesShowcase })));
const StatsCounter = lazy(() => import('@/components/landing/StatsCounter').then(m => ({ default: m.StatsCounter })));
const SustainabilitySection = lazy(() => import('@/components/landing/SustainabilitySection').then(m => ({ default: m.SustainabilitySection })));
const TestimonialsCarousel = lazy(() => import('@/components/landing/TestimonialsCarousel').then(m => ({ default: m.TestimonialsCarousel })));
const PricingSection = lazy(() => import('@/components/landing/PricingSection').then(m => ({ default: m.PricingSection })));
const FAQSection = lazy(() => import('@/components/landing/FAQSection').then(m => ({ default: m.FAQSection })));
const CTASection = lazy(() => import('@/components/landing/CTASection').then(m => ({ default: m.CTASection })));
const LandingFooter = lazy(() => import('@/components/landing/LandingFooter').then(m => ({ default: m.LandingFooter })));
const StickyMobileCTA = lazy(() => import('@/components/landing/StickyMobileCTA').then(m => ({ default: m.StickyMobileCTA })));
const ExitIntentModal = lazy(() => import('@/components/landing/ExitIntentModal').then(m => ({ default: m.ExitIntentModal })));

export default function Landing() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const REVEAL_SELECTOR = '.reveal-up, .reveal-down, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .scroll-reveal, .line-grow, .word-reveal';

  // Unified IntersectionObserver + MutationObserver for reveals
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('visible');
          else e.target.classList.remove('visible');
        });
      },
      { root: container, threshold: 0.08 }
    );

    container.querySelectorAll(REVEAL_SELECTOR).forEach(el => io.observe(el));

    const mo = new MutationObserver(() => {
      container.querySelectorAll(REVEAL_SELECTOR).forEach(el => io.observe(el));
    });
    mo.observe(container, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  // Parallax scroll + header scroll detection
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          document.documentElement.style.setProperty('--scroll-y', String(container.scrollTop));
          setScrolled(container.scrollTop > 60);
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
    { id: 'features', label: t('landing.nav.features') },
    { id: 'sustainability', label: t('landing.nav.sustainability') },
    { id: 'pricing', label: t('landing.nav.pricing') },
  ];

  return (
    <>
      <Helmet>
        <title>{t('landing.title')}</title>
        <meta name="description" content={t('landing.meta')} />
        <meta property="og:title" content="BURS | Your Personal Stylist" />
        <meta property="og:description" content="Upload your closet. Let BURS style you. Save the planet by wearing what you already own." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://burs.me" />
        <meta property="og:image" content="https://bursai.lovable.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BURS | Your Personal Stylist" />
        <meta name="twitter:description" content="Upload your closet. Let BURS style you. Save the planet by wearing what you already own." />
        <meta name="twitter:image" content="https://bursai.lovable.app/og-image.png" />
        <link rel="canonical" href="https://burs.me" />
        <link rel="alternate" hrefLang="x-default" href="https://burs.me" />
        <link rel="alternate" hrefLang={locale} href={`https://burs.me?lang=${locale}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "BURS",
          "applicationCategory": "LifestyleApplication",
          "operatingSystem": "Web",
          "description": "AI-powered wardrobe operating system. Organize clothes, build outfits, and get smart styling help.",
          "url": "https://burs.me",
          "image": "https://bursai.lovable.app/og-image.png",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "1250",
            "bestRating": "5"
          }
        })}</script>
      </Helmet>

      <div className="dark-landing noise-overlay" ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
        <ScrollProgress />
        <div className="font-space selection:bg-indigo-500/20">

          {/* ── Floating Capsule Header ── */}
          <header
            className="fixed top-3 left-3 right-3 z-50 rounded-2xl hyper-glass"
            style={{ background: 'rgba(3,3,5,0.7)' }}
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} role="button" aria-label="Scroll to top">
                <img src={bursLandingLogo} alt="BURS home" className="h-6 object-contain transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(99,102,241,0.4)]" width={80} height={24} loading="eager" fetchPriority="high" />
              </div>
              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400" aria-label="Page sections">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="relative hover:text-white transition-colors duration-300 after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-px after:bg-indigo-400 after:transition-all after:duration-300 hover:after:w-full">{l.label}</button>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <LanguageSwitcher />
                <button
                  onClick={() => navigate('/auth')}
                  className="hidden md:block px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 text-white"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    boxShadow: '0 0 20px rgba(99,102,241,0.1)',
                  }}
                >
                  {t('landing.login')}
                </button>
                <button className="md:hidden text-gray-400 hover:text-white p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
                  {mobileOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="md:hidden border-t border-white/5 animate-fade-in" role="menu">
                <div className="flex flex-col gap-1 px-6 py-4 text-sm text-gray-400">
                  {navLinks.map(l => (
                    <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-white transition-colors" role="menuitem">{l.label}</button>
                  ))}
                  <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-white text-[#030305] py-3 rounded-full text-center font-medium" role="menuitem">{t('landing.login')}</button>
                </div>
              </div>
            )}
          </header>

          {/* Sections */}
          <HeroSection />

          <Suspense fallback={<div style={{ minHeight: '400vh' }} aria-hidden="true" />}>
            <SocialTicker />
            <TrustLogos />
            <HowItWorks />
            <FeaturesShowcase />
            <StatsCounter />
            <SustainabilitySection />
            <TestimonialsCarousel />
            <PricingSection />
            <FAQSection />
            <CTASection />
            <LandingFooter />
            <StickyMobileCTA />
            <ExitIntentModal />
          </Suspense>
        </div>
        <CookieConsent />
      </div>
    </>
  );
}
