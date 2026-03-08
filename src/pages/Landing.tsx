import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X } from 'lucide-react';
import bursLogo from '@/assets/burs-logo-white.png';
import { useLanguage } from '@/contexts/LanguageContext';
import { CookieConsent } from '@/components/landing/CookieConsent';
import { HeroSection } from '@/components/landing2/HeroSection';

const TrustStrip = lazy(() => import('@/components/landing2/TrustStrip').then(m => ({ default: m.TrustStrip })));
const ProblemSection = lazy(() => import('@/components/landing2/ProblemSection').then(m => ({ default: m.ProblemSection })));
const SystemSection = lazy(() => import('@/components/landing2/SystemSection').then(m => ({ default: m.SystemSection })));
const AIStylistSection = lazy(() => import('@/components/landing2/AIStylistSection').then(m => ({ default: m.AIStylistSection })));
const WardrobeVisualSection = lazy(() => import('@/components/landing2/WardrobeVisualSection').then(m => ({ default: m.WardrobeVisualSection })));
const OutfitBuilderSection = lazy(() => import('@/components/landing2/OutfitBuilderSection').then(m => ({ default: m.OutfitBuilderSection })));
const WeeklyPlannerSection = lazy(() => import('@/components/landing2/WeeklyPlannerSection').then(m => ({ default: m.WeeklyPlannerSection })));
const HowItWorksSection = lazy(() => import('@/components/landing2/HowItWorksSection').then(m => ({ default: m.HowItWorksSection })));
const PricingSection = lazy(() => import('@/components/landing2/PricingSection').then(m => ({ default: m.PricingSection })));
const SocialProofSection = lazy(() => import('@/components/landing2/SocialProofSection').then(m => ({ default: m.SocialProofSection })));
const FinalCTASection = lazy(() => import('@/components/landing2/FinalCTASection').then(m => ({ default: m.FinalCTASection })));
const LandingFooter = lazy(() => import('@/components/landing2/LandingFooter').then(m => ({ default: m.LandingFooter })));

const NAV_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it Works' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'ai-stylist', label: 'AI Stylist' },
];

const SectionDivider = () => <div className="lv2-section-divider" aria-hidden="true" />;

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => setScrolled(container.scrollTop > 80);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { root: container, threshold: 0.08 }
    );

    const observe = () => container.querySelectorAll('.lv2-reveal').forEach(el => io.observe(el));
    observe();

    const mo = new MutationObserver(observe);
    mo.observe(container, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>BURS — AI Wardrobe Operating System</title>
        <meta name="description" content="Digitize your wardrobe, generate better outfits, and plan what to wear with an AI stylist built around your real clothes." />
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
      </Helmet>

      <div className="landing-v2" ref={scrollRef} style={{ height: '100vh', overflowY: 'auto' }}>
        {/* ── Navbar ── */}
        <header className={`fixed top-0 w-full z-50 lv2-navbar ${scrolled ? 'lv2-navbar--scrolled' : ''}`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">
              <img src={bursLogo} alt="BURS" className="h-5 object-contain" />
            </button>

            <nav className="hidden md:flex items-center gap-10 text-sm tracking-wide" style={{ color: 'var(--lv2-text-tertiary)' }}>
              {NAV_LINKS.map(l => (
                <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors duration-300">{l.label}</button>
              ))}
            </nav>

            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/auth')} className="hidden md:block text-sm transition-colors duration-300 hover:text-white" style={{ color: 'var(--lv2-text-secondary)' }}>
                Sign In
              </button>
              <button onClick={() => navigate('/auth')} className="hidden md:block lv2-cta-primary px-5 py-2 rounded-full text-xs font-semibold tracking-wide">
                Start Free
              </button>
              <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} style={{ color: 'var(--lv2-text-secondary)' }}>
                {mobileOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="md:hidden border-t border-[--lv2-border] animate-fade-in" style={{ background: 'rgba(5,7,10,0.95)', backdropFilter: 'blur(20px)' }}>
              <div className="flex flex-col gap-1 px-6 py-4 text-sm" style={{ color: 'var(--lv2-text-secondary)' }}>
                {NAV_LINKS.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-white transition-colors">{l.label}</button>
                ))}
                <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 lv2-cta-primary py-3 rounded-full text-center text-sm font-semibold">
                  Start Free
                </button>
              </div>
            </div>
          )}
        </header>

        <HeroSection />

        <Suspense fallback={<div style={{ minHeight: '300vh' }} aria-hidden="true" />}>
          <TrustStrip />
          <SectionDivider />
          <ProblemSection />
          <SectionDivider />
          <SystemSection />
          <SectionDivider />
          <AIStylistSection />
          <SectionDivider />
          <WardrobeVisualSection />
          <OutfitBuilderSection />
          <SectionDivider />
          <WeeklyPlannerSection />
          <SectionDivider />
          <HowItWorksSection />
          <SectionDivider />
          <PricingSection />
          <SocialProofSection />
          <FinalCTASection />
          <LandingFooter />
        </Suspense>

        <CookieConsent />
      </div>
    </>
  );
}
