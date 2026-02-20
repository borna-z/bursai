import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X, Sparkles, Shirt, Heart, Leaf, Shield, ArrowRight, Smartphone, Instagram, Twitter, Check } from 'lucide-react';
import { BursMonogram } from '@/components/ui/BursMonogram';
import appScreenshot from '@/assets/app-screenshot-home.png';

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

      {/* Force light theme regardless of user preference */}
      <div className="force-light">
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground/10">

          {/* ── Header ── */}
          <header className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <BursMonogram size={36} />
                <span className="text-foreground text-lg font-medium tracking-[0.2em] hidden sm:block" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
              </div>

              <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-muted-foreground">
                {navLinks.map(l => (
                  <button key={l.id} onClick={() => scrollTo(l.id)} className="hover:text-foreground transition-colors duration-300">{l.label}</button>
                ))}
              </nav>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/auth')}
                  className="hidden md:block bg-foreground text-background px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-all duration-300 hover:scale-105"
                >
                  Log In
                </button>
                <button className="md:hidden text-muted-foreground hover:text-foreground p-2" onClick={() => setMobileOpen(!mobileOpen)}>
                  {mobileOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
              <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-lg animate-fade-in">
                <div className="flex flex-col gap-1 px-6 py-4 text-sm text-muted-foreground">
                  {navLinks.map(l => (
                    <button key={l.id} onClick={() => scrollTo(l.id)} className="py-3 text-left hover:text-foreground transition-colors">{l.label}</button>
                  ))}
                  <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-foreground text-background py-3 rounded-full text-center font-medium">Log In</button>
                </div>
              </div>
            )}
          </header>

          {/* ── Hero ── */}
          <section className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden px-6 md:px-12 pt-20 pb-16">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-16 relative z-10">
              <div className="w-full md:w-1/2 flex flex-col items-start gap-8 animate-fade-in">
                <BursMonogram size={80} className="animate-fade-in" />

                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-muted/30 text-xs tracking-wide text-muted-foreground backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                  Sustainable AI Styling
                </div>

                <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground leading-[1.1]" style={{ fontFamily: "'Sora', sans-serif" }}>
                  Rediscover <br className="hidden md:block" /> your wardrobe.
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground font-light max-w-lg leading-relaxed">
                  Upload your clothes. Let Burs' AI generate daily outfit combinations from what you already own.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
                  <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-8 py-4 bg-foreground text-background rounded-full font-medium hover:scale-105 transition-transform duration-300 flex items-center justify-center gap-2">
                    Get Started
                    <ArrowRight size={18} strokeWidth={2} />
                  </button>
                  <button onClick={() => scrollTo('how-it-works')} className="w-full sm:w-auto px-8 py-4 border border-border text-foreground rounded-full font-medium hover:bg-muted/50 transition-colors duration-300 flex items-center justify-center gap-2">
                    <Smartphone size={18} strokeWidth={1.5} />
                    See How It Works
                  </button>
                </div>
              </div>

              <div className="w-full md:w-1/2 flex justify-center md:justify-end relative animate-fade-in" style={{ animationDelay: '200ms' }}>
                <div className="relative w-[300px] md:w-[360px] aspect-[9/19.5] bg-background rounded-[2.5rem] border-[5px] border-border overflow-hidden shadow-2xl shadow-foreground/5 transform md:rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                  <img src={appScreenshot} alt="Burs App Interface" className="w-full h-full object-contain bg-background" />
                </div>
              </div>
            </div>
          </section>

          {/* ── How It Works ── */}
          <section id="how-it-works" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-20 scroll-reveal" style={{ fontFamily: "'Sora', sans-serif", '--delay': '80ms' } as React.CSSProperties}>
                Three steps. Zero effort.
              </h2>

              {[
                { num: '01', icon: Shirt, title: 'Snap your clothes', desc: 'Point your camera at any garment. AI instantly tags color, material, and style — digitizing your closet in seconds.' },
                { num: '02', icon: Sparkles, title: 'AI works its magic', desc: 'Our neural styling engine learns your taste, checks weather and calendar, then generates perfect outfit combinations from pieces you own.' },
                { num: '03', icon: Heart, title: 'Wear & Care', desc: 'Breathe life into forgotten garments. Track what you wear, discover hidden gems, and fall in love with your wardrobe again.' },
              ].map((s, i) => (
                <div key={s.num} className="flex items-start gap-6 md:gap-10 py-10 border-t border-border scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                  <span className="text-6xl md:text-7xl font-bold text-muted-foreground/10 leading-none select-none shrink-0" style={{ fontFamily: "'Sora', sans-serif" }}>{s.num}</span>
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <s.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Sustainability ── */}
          <section id="sustainability" className="px-6 py-28 md:py-40 bg-muted/30">
            <div className="max-w-3xl mx-auto text-center">
              <div className="scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>
                <Leaf className="w-8 h-8 mx-auto mb-8 text-muted-foreground" strokeWidth={1} />
                <blockquote className="text-2xl md:text-4xl font-bold tracking-tight leading-snug" style={{ fontFamily: "'Sora', sans-serif" }}>
                  "The most sustainable garment<br className="hidden sm:block" /> is the one already in your closet."
                </blockquote>
                <p className="mt-8 text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
                  Fast fashion accounts for 10% of global carbon emissions. Burs helps you shop less and style more — by making the most of what you already own.
                </p>
              </div>

              <div className="mt-16 grid grid-cols-3 gap-px rounded-2xl overflow-hidden border border-border">
                {[
                  { stat: '80%', label: 'of clothes are under-worn' },
                  { stat: '92M', label: 'tons of textile waste yearly' },
                  { stat: '∞', label: 'outfits from your closet' },
                ].map((s, i) => (
                  <div key={s.label} className="bg-background p-6 md:p-10 scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                    <div className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>{s.stat}</div>
                    <div className="text-xs text-muted-foreground tracking-wide">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Mission / Trust ── */}
          <section id="mission" className="px-6 py-28 md:py-40">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Our Mission</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-20 scroll-reveal" style={{ fontFamily: "'Sora', sans-serif", '--delay': '80ms' } as React.CSSProperties}>
                Built on trust.
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: 'Privacy-first', desc: 'End-to-end encrypted. Your wardrobe data never leaves your control.' },
                  { icon: Shield, title: 'Zero lock-in', desc: 'Export everything. Cancel anytime. No questions asked.' },
                  { icon: Smartphone, title: 'Always on', desc: 'Offline-ready PWA. Your wardrobe is accessible anywhere, anytime.' },
                ].map((t, i) => (
                  <div key={t.title} className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-4 scroll-reveal" style={{ '--delay': `${(i + 1) * 120}ms` } as React.CSSProperties}>
                    <t.icon className="w-5 h-5 mx-auto text-muted-foreground" strokeWidth={1.5} />
                    <h3 className="font-semibold tracking-tight">{t.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section id="pricing" className="px-6 py-28 md:py-40 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Pricing</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 scroll-reveal" style={{ fontFamily: "'Sora', sans-serif", '--delay': '80ms' } as React.CSSProperties}>
                Simple, transparent pricing.
              </h2>
              <p className="text-center text-muted-foreground text-sm mb-16 scroll-reveal" style={{ '--delay': '120ms' } as React.CSSProperties}>
                Start free. Upgrade when you're ready.
              </p>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Free */}
                <div className="bg-background border border-border rounded-2xl p-8 md:p-10 flex flex-col scroll-reveal" style={{ '--delay': '160ms' } as React.CSSProperties}>
                  <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>Free</h3>
                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>0 kr</span>
                    <span className="text-muted-foreground text-sm ml-1">/ month</span>
                  </div>
                  <ul className="space-y-3 text-sm text-muted-foreground flex-1">
                    {['10 garments', '10 outfits / month', 'Basic AI styling', 'Weather-based suggestions'].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-foreground shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/auth')}
                    className="mt-8 w-full py-3.5 border border-border text-foreground rounded-full font-medium hover:bg-muted/50 transition-colors duration-300 text-sm"
                  >
                    Get Started
                  </button>
                </div>

                {/* Premium */}
                <div className="bg-foreground text-background border border-foreground rounded-2xl p-8 md:p-10 flex flex-col relative overflow-hidden scroll-reveal" style={{ '--delay': '240ms' } as React.CSSProperties}>
                  <div className="absolute top-4 right-4 bg-background text-foreground text-[10px] tracking-widest uppercase font-semibold px-3 py-1 rounded-full">
                    Popular
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>Premium</h3>
                  <div className="mt-4 mb-2">
                    <span className="text-4xl font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>79 kr</span>
                    <span className="text-background/60 text-sm ml-1">/ month</span>
                  </div>
                  <p className="text-background/50 text-xs mb-6">or 699 kr / year — save ~26%</p>
                  <ul className="space-y-3 text-sm text-background/80 flex-1">
                    {['Unlimited garments', 'Unlimited outfits', 'Advanced AI styling', 'Calendar & weather sync', 'Priority support'].map(f => (
                      <li key={f} className="flex items-center gap-2.5">
                        <Check size={14} strokeWidth={2} className="text-background shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate('/auth')}
                    className="mt-8 w-full py-3.5 bg-background text-foreground rounded-full font-medium hover:opacity-90 transition-all duration-300 text-sm hover:scale-[1.02]"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Final CTA ── */}
          <section className="px-6 py-28 md:py-40">
            <div className="max-w-lg mx-auto text-center space-y-8 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>
              <BursMonogram size={56} className="mx-auto" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
                Join the movement.
              </h2>
              <p className="text-muted-foreground text-sm tracking-wide">
                Dress smarter. Waste less. Rediscover your style with Burs.
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="inline-flex items-center gap-2 bg-foreground text-background h-14 px-12 rounded-full text-sm font-semibold tracking-widest uppercase hover:opacity-90 transition-all hover:scale-105"
              >
                Log In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* ── How to Download ── */}
          <section id="download" className="px-6 py-28 md:py-40 bg-muted/30">
            <div className="max-w-4xl mx-auto">
              <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 scroll-reveal" style={{ '--delay': '0ms' } as React.CSSProperties}>Download</p>
              <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-6 scroll-reveal" style={{ fontFamily: "'Sora', sans-serif", '--delay': '80ms' } as React.CSSProperties}>
                Install BURS on your phone.
              </h2>
              <p className="text-center text-muted-foreground text-sm mb-16 scroll-reveal" style={{ '--delay': '120ms' } as React.CSSProperties}>
                No app store needed. Add it directly from your browser.
              </p>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* iPhone */}
                <div className="bg-background border border-border rounded-2xl p-8 md:p-10 scroll-reveal" style={{ '--delay': '160ms' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>iPhone</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">1</span>
                      <span>Open <strong className="text-foreground">burse.me/auth</strong> in Safari</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">2</span>
                      <span>Tap the <strong className="text-foreground">Share</strong> button (square with arrow)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">3</span>
                      <span>Tap <strong className="text-foreground">"Add to Home Screen"</strong></span>
                    </li>
                  </ol>
                </div>

                {/* Android */}
                <div className="bg-background border border-border rounded-2xl p-8 md:p-10 scroll-reveal" style={{ '--delay': '240ms' } as React.CSSProperties}>
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67c-.19-.29-.54-.38-.84-.22-.3.16-.42.54-.26.85L6.4 9.48A10.78 10.78 0 002 18h20a10.78 10.78 0 00-4.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" /></svg>
                    <h3 className="text-lg font-semibold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>Android</h3>
                  </div>
                  <ol className="space-y-4 text-sm text-muted-foreground">
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">1</span>
                      <span>Open <strong className="text-foreground">burse.me/auth</strong> in Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">2</span>
                      <span>Tap the <strong className="text-foreground">three-dot menu</strong> (top right)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground">3</span>
                      <span>Tap <strong className="text-foreground">"Install App"</strong> or "Add to Home Screen"</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="border-t border-border px-6 py-10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground tracking-wide">
              <div className="flex items-center gap-2">
                <BursMonogram size={20} />
                <span className="text-foreground font-medium tracking-[0.12em]" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
              </div>
              <div className="flex gap-6">
                <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
                <a href="/contact" className="hover:text-foreground transition-colors">Contact</a>
              </div>
              <div className="flex items-center gap-5">
                <a href="#" aria-label="Instagram" className="hover:text-foreground transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
                <a href="#" aria-label="Twitter" className="hover:text-foreground transition-colors"><Twitter size={16} strokeWidth={1.5} /></a>
              </div>
              <div className="text-center md:text-right space-y-1">
                <span className="block">© {new Date().getFullYear()} BURS AB</span>
                <span className="block text-[10px] text-muted-foreground/70">All data processed in accordance with GDPR.</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
