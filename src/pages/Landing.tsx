import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X, Sparkles, Shirt, Heart, Leaf, Shield, ArrowRight, Smartphone, Instagram, Twitter, Check } from 'lucide-react';
import bursLandingLogo from '@/assets/burs-landing-logo-white.png';


export default function Landing() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Single observer for all scroll-reveal elements
  useEffect(() => {
    const els = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.15 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { id: 'how-it-works', label: 'How it works' },
    { id: 'sustainability', label: 'Sustainability' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'download', label: 'Download' },
  ];

  return (
    <>
      <Helmet>
        <title>BURS | Rediscover Your Wardrobe with AI</title>
        <meta name="description" content="Upload your closet. Let Burs style you. Save the planet by wearing what you already own." />
      </Helmet>

      <div className="dark-landing">
        <div className="min-h-screen font-space selection:bg-white/10">

          {/* ── Header ── */}
          <header className="fixed top-0 w-full z-50 glass-panel border-b border-white/5">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <img src={bursLandingLogo} alt="BURS" className="h-6 object-contain" />
              </div>

              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-white transition-colors duration-300">{l.label}</button>
                ))}
              </nav>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/auth')}
                  className="hidden md:block bg-white text-[#030305] px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-all duration-300 hover:scale-105"
                >
                  Log In
                </button>
                <button className="md:hidden text-gray-400 hover:text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>
                  {mobileOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
              <div className="md:hidden border-t border-white/5 glass-panel animate-fade-in">
                <div className="flex flex-col gap-1 px-6 py-4 text-sm text-gray-400">
                  {navLinks.map(l => (
                    <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-white transition-colors">{l.label}</button>
                  ))}
                  <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-white text-[#030305] py-3 rounded-full text-center font-medium">Log In</button>
                </div>
              </div>
            )}
          </header>

          {/* ── Hero ── */}
          <section className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden px-6 md:px-12 pt-20 pb-16">
            <div className="aurora-glow" />

            {/* Floating decorative elements */}
            <div className="absolute top-1/4 left-[15%] w-2 h-2 rounded-full bg-white/10 anti-gravity" />
            <div className="absolute top-1/3 right-[20%] w-3 h-3 rounded-full bg-white/5 anti-gravity-delayed" />
            <div className="absolute bottom-1/3 left-[25%] w-1.5 h-1.5 rounded-full bg-white/10 anti-gravity-delayed" />

            <div className="max-w-3xl mx-auto w-full flex flex-col items-center text-center gap-8 relative z-10 animate-fade-in">
                

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs tracking-wide text-gray-400 backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Sustainable AI Styling
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1] font-space">
                  Designed for <br className="hidden md:block" />
                  <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    the next dimension.
                  </span>
                </h1>

                <p className="text-lg md:text-xl text-gray-400 font-light max-w-lg leading-relaxed">
                  Pure Scandinavian minimalism meets brutal computational power in a frictionless experience.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
                  <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-8 py-4 bg-white text-[#030305] rounded-full font-medium hover:scale-105 transition-transform duration-300 flex items-center justify-center gap-2">
                    Get Started
                    <ArrowRight size={18} strokeWidth={2} />
                  </button>
                  <button onClick={() => scrollTo('how-it-works')} className="w-full sm:w-auto px-8 py-4 border border-white/10 text-white rounded-full font-medium hover:bg-white/5 transition-colors duration-300 flex items-center justify-center gap-2 glass-panel">
                    <Smartphone size={18} strokeWidth={1.5} />
                    Explore
                  </button>
                </div>
            </div>
          </section>

          {/* ── Trial Campaign Banner ── */}
          <section className="px-6 py-12 md:py-16">
            <div className="max-w-3xl mx-auto">
              <div className="relative overflow-hidden rounded-2xl glass-panel p-8 md:p-12 text-center border border-amber-400/20">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                <p className="text-[10px] tracking-[0.4em] uppercase text-amber-400 mb-3 font-semibold">Limited Offer</p>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 text-white font-space">
                  Try Premium free for 30 days.
                </h2>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                  Full access to unlimited garments, unlimited outfits and smarter AI — no commitment, cancel anytime.
                </p>
                <button
                  onClick={() => navigate('/auth')}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white h-12 px-8 rounded-full text-sm font-semibold hover:opacity-90 transition-all hover:scale-105"
                >
                  Start Free Trial
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          </section>

          {/* ── How It Works ── */}
          <section id="how-it-works" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-20 text-white font-space scroll-reveal" style={{ '--delay': '80ms' } as React.CSSProperties}>
                Three steps. Zero effort.
              </h2>

              {[
                { num: '01', icon: Shirt, title: 'Snap your clothes', desc: 'Point your camera at any garment. AI instantly tags color, material, and style — digitizing your closet in seconds.' },
                { num: '02', icon: Sparkles, title: 'AI works its magic', desc: 'Our neural styling engine learns your taste, checks weather and calendar, then generates perfect outfit combinations from pieces you own.' },
                { num: '03', icon: Heart, title: 'Wear & Care', desc: 'Breathe life into forgotten garments. Track what you wear, discover hidden gems, and fall in love with your wardrobe again.' },
              ].map((s, i) => (
                <div key={s.num} className="flex items-start gap-6 md:gap-10 py-10 border-t border-white/5 scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                  <span className="text-6xl md:text-7xl font-bold text-white/5 leading-none select-none shrink-0 font-space">{s.num}</span>
                  <div className="pt-2 space-y-2">
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

          {/* ── Sustainability ── */}
          <section id="sustainability" className="px-6 py-28 md:py-40">
            <div className="max-w-3xl mx-auto text-center">
              <div className="scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>
                <Leaf className="w-8 h-8 mx-auto mb-8 text-gray-500" strokeWidth={1} />
                <blockquote className="text-2xl md:text-4xl font-bold tracking-tight leading-snug text-white font-space">
                  "The most sustainable garment<br className="hidden sm:block" /> is the one already in your closet."
                </blockquote>
                <p className="mt-8 text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                  Fast fashion accounts for 10% of global carbon emissions. Burs helps you shop less and style more — by making the most of what you already own.
                </p>
              </div>

              <div className="mt-16 grid grid-cols-3 gap-px rounded-2xl overflow-hidden">
                {[
                  { stat: '80%', label: 'of clothes are under-worn' },
                  { stat: '92M', label: 'tons of textile waste yearly' },
                  { stat: '∞', label: 'outfits from your closet' },
                ].map((s, i) => (
                  <div key={s.label} className="glass-panel p-6 md:p-10 scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                    <div className="text-2xl md:text-3xl font-bold mb-2 text-white font-space">{s.stat}</div>
                    <div className="text-xs text-gray-500 tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Mission / Trust ── */}
          <section id="mission" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Our Mission</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-20 text-white font-space scroll-reveal" style={{ '--delay': '80ms' } as React.CSSProperties}>
                Built on trust.
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: 'Privacy-first', desc: 'End-to-end encrypted. Your wardrobe data never leaves your control.' },
                  { icon: Shield, title: 'Zero lock-in', desc: 'Export everything. Cancel anytime. No questions asked.' },
                  { icon: Smartphone, title: 'Always on', desc: 'Offline-ready PWA. Your wardrobe is accessible anywhere, anytime.' },
                ].map((t, i) => (
                  <div key={t.title} className="glass-panel rounded-2xl p-8 md:p-10 space-y-4 scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                    <t.icon className="w-5 h-5 mx-auto text-gray-500" strokeWidth={1.5} />
                    <h3 className="font-semibold tracking-tight text-white">{t.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space scroll-reveal" style={{ '--delay': '80ms' } as React.CSSProperties}>
                Simple, transparent pricing.
              </h2>
              <p className="text-center text-gray-400 text-sm mb-16 scroll-reveal" style={{ '--delay': '120ms' } as React.CSSProperties}>
                Start free. Upgrade when you're ready.
              </p>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Free */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 flex flex-col scroll-reveal" style={{ '--delay': '160ms' } as React.CSSProperties}>
                  <h3 className="text-lg font-semibold tracking-tight text-white font-space">Free</h3>
                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-bold text-white font-space">0 kr</span>
                    <span className="text-gray-500 text-sm ml-1">/ month</span>
                  </div>
                  <ul className="space-y-3 text-sm text-gray-400 flex-1">
                    {['10 garments', '10 outfits / month', 'Basic AI styling', 'Weather-based suggestions'].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-white shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/auth')}
                    className="mt-8 w-full py-3.5 border border-white/10 text-white rounded-full font-medium hover:bg-white/5 transition-colors duration-300 text-sm"
                  >
                    Get Started
                  </button>
                </div>

                {/* Premium */}
                <div className="bg-white text-[#030305] rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden scroll-reveal" style={{ '--delay': '240ms' } as React.CSSProperties}>
                  <div className="absolute top-4 right-4 bg-amber-400 text-[#030305] text-[10px] tracking-widest uppercase font-bold px-3 py-1 rounded-full">
                    30 days free
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight font-space">Premium</h3>
                  <div className="mt-4 mb-2">
                    <span className="text-4xl font-bold font-space">0 kr</span>
                    <span className="text-[#030305]/60 text-sm ml-1">for 30 days</span>
                  </div>
                  <p className="text-[#030305]/50 text-xs mb-6">Then 79 kr/month · or 699 kr/year — save ~26%</p>
                  <ul className="space-y-3 text-sm text-[#030305]/70 flex-1">
                    {['Unlimited garments', 'Unlimited outfits', 'Advanced AI styling', 'Calendar & weather sync', 'Priority support'].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-[#030305] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/auth')}
                    className="mt-8 w-full py-3.5 bg-[#030305] text-white rounded-full font-medium hover:opacity-90 transition-all duration-300 text-sm hover:scale-[1.02]"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section className="px-6 py-28 md:py-40 relative">
            <div className="aurora-glow" />
            <div className="max-w-lg mx-auto text-center space-y-8 scroll-reveal relative z-10" style={{ '--delay': '0ms' } as React.CSSProperties}>
              <img src={bursLandingLogo} alt="BURS" className="h-10 mx-auto" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-space">
                Join the movement.
              </h2>
              <p className="text-gray-400 text-sm tracking-wide">
                Dress smarter. Waste less. Rediscover your style with Burs.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="inline-flex items-center gap-2 bg-white text-[#030305] h-14 px-12 rounded-full text-sm font-semibold tracking-widest uppercase hover:opacity-90 transition-all hover:scale-105"
              >
                Log In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* ── How to Download ── */}
          <section id="download" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Download</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 text-white font-space scroll-reveal" style={{ '--delay': '80ms' } as React.CSSProperties}>
                Install BURS on your phone.
              </h2>
              <p className="text-center text-gray-400 text-sm mb-16 scroll-reveal" style={{ '--delay': '120ms' } as React.CSSProperties}>
                No app store needed. Add it directly from your browser.
              </p>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* iPhone */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 scroll-reveal" style={{ '--delay': '160ms' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight text-white font-space">iPhone</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-gray-400">
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">1</span>
                      <span>Open <strong className="text-white">burs.me/auth</strong> in Safari</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">2</span>
                      <span>Tap the <strong className="text-white">Share</strong> button (square with arrow)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">3</span>
                      <span>Tap <strong className="text-white">"Add to Home Screen"</strong></span>
                    </li>
                  </ol>
                </div>

                {/* Android */}
                <div className="glass-panel rounded-2xl p-8 md:p-10 scroll-reveal" style={{ '--delay': '240ms' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight text-white font-space">Android</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-gray-400">
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">1</span>
                      <span>Open <strong className="text-white">burs.me/auth</strong> in Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">2</span>
                      <span>Tap the <strong className="text-white">three-dot menu</strong> (top right)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white">3</span>
                      <span>Tap <strong className="text-white">"Install App"</strong> or "Add to Home Screen"</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="border-t border-white/5 px-6 py-10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500 tracking-wide">
              <div className="flex items-center gap-2">
                <img src={bursLandingLogo} alt="BURS" className="h-5 object-contain" />
              </div>
              <div className="flex gap-6">
                <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="/contact" className="hover:text-white transition-colors">Contact</a>
              </div>
              <div className="flex items-center gap-5">
                <a href="#" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
                <a href="#" aria-label="Twitter" className="hover:text-white transition-colors"><Twitter size={16} strokeWidth={1.5} /></a>
              </div>
              <div className="text-center md:text-right space-y-1">
                <span className="block text-gray-400">© {new Date().getFullYear()} BURS AB</span>
                <span className="block text-[10px] text-gray-600">All data processed in accordance with GDPR.</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
