import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { HeroSection } from '@/components/landing/HeroSection';
import { CookieConsent } from '@/components/landing/CookieConsent';

const BentoGrid = lazy(() => import('@/components/landing/BentoGrid').then(m => ({ default: m.BentoGrid })));
const ProductShowcase = lazy(() => import('@/components/landing/ProductShowcase').then(m => ({ default: m.ProductShowcase })));
const TestimonialsCarousel = lazy(() => import('@/components/landing/TestimonialsCarousel').then(m => ({ default: m.TestimonialsCarousel })));
const PricingSection = lazy(() => import('@/components/landing/PricingSection').then(m => ({ default: m.PricingSection })));
const FooterCTA = lazy(() => import('@/components/landing/FooterCTA').then(m => ({ default: m.FooterCTA })));
const StickyMobileCTA = lazy(() => import('@/components/landing/StickyMobileCTA').then(m => ({ default: m.StickyMobileCTA })));
const ExitIntentModal = lazy(() => import('@/components/landing/ExitIntentModal').then(m => ({ default: m.ExitIntentModal })));

export default function Landing() {
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const REVEAL_SELECTOR = '.reveal-up, .reveal-scale, .scroll-reveal';

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

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
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
    { id: 'features', label: t('landing.nav.features') },
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
        <meta name="twitter:description" content="Upload your closet. Let BURS style you." />
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
          "description": "AI-powered wardrobe operating system.",
          "url": "https://burs.me",
          "image": "https://bursai.lovable.app/og-image.png",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
          "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "reviewCount": "1250", "bestRating": "5" }
        })}</script>
      </Helmet>

      <div className="dark-landing" ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
        <div className="font-space selection:bg-indigo-500/20">

          {/* ── Header ── */}
          <header
            className={`fixed z-50 transition-all duration-500 ease-out ${
              scrolled
                ? 'top-3 left-3 right-3 rounded-2xl'
                : 'top-0 left-0 right-0'
            }`}
            style={{
              background: scrolled ? 'rgba(3,3,5,0.8)' : 'transparent',
              backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
              borderBottom: scrolled ? 'none' : '1px solid rgba(255,255,255,0.03)',
              border: scrolled ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}
            role="navigation"
            aria-label="Main navigation"
          >
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3.5">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} role="button" aria-label="Scroll to top">
                <img src={bursLandingLogo} alt="BURS home" className="h-5 object-contain" width={80} height={20} loading="eager" fetchPriority="high" />
              </div>
              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400" aria-label="Page sections">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors duration-300">{l.label}</button>
                ))}
              </nav>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/auth')}
                  className="hidden md:block px-6 py-2 rounded-full text-sm font-medium text-white border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300"
                >
                  {t('landing.login')}
                </button>
                <button className="md:hidden text-gray-400 hover:text-white p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}>
                  {mobileOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
            {mobileOpen && (
              <div className="md:hidden border-t border-white/[0.04] animate-fade-in" role="menu">
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

          <Suspense fallback={<div style={{ minHeight: '100vh' }} aria-hidden="true" />}>
            <ProductShowcase />
            <BentoGrid />
            <TestimonialsCarousel />
            <PricingSection />
            <FooterCTA />
            <StickyMobileCTA />
            <ExitIntentModal />
          </Suspense>
        </div>
        <CookieConsent />
      </div>
    </>
  );
}
