import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Menu, X, Sparkles, Shirt, Heart, Leaf, Shield, ArrowRight, Smartphone, Instagram, Twitter } from 'lucide-react';
import bursLogo from '@/assets/burs-logo.png';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>BURS | Rediscover Your Wardrobe with AI</title>
        <meta name="description" content="Upload your closet. Let Burs style you. Save the planet by wearing what you already own." />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans selection:bg-white/10">

        {/* ── Header ── */}
        <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src={bursLogo} alt="Burs" className="h-9 w-9 rounded-xl object-contain" />
              <span className="text-white text-lg font-medium tracking-[0.2em] hidden sm:block" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
            </div>

            <nav className="hidden md:flex items-center gap-10 text-sm font-light tracking-wide text-gray-400">
              <button onClick={() => scrollTo('how-it-works')} className="hover:text-white transition-colors duration-300">How it works</button>
              <button onClick={() => scrollTo('sustainability')} className="hover:text-white transition-colors duration-300">Sustainability</button>
              <button onClick={() => scrollTo('mission')} className="hover:text-white transition-colors duration-300">Our Mission</button>
            </nav>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/auth')}
                className="hidden md:block bg-white text-black px-6 py-2.5 rounded-full text-sm font-medium hover:bg-gray-200 transition-all duration-300 hover:scale-105"
              >
                Get Early Access
              </button>
              <button className="md:hidden text-gray-300 hover:text-white p-2" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Mobile drawer */}
          {mobileOpen && (
            <div className="md:hidden border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-lg animate-fade-in">
              <div className="flex flex-col gap-1 px-6 py-4 text-sm text-gray-400">
                <button onClick={() => scrollTo('how-it-works')} className="py-3 text-left hover:text-white transition-colors">How it works</button>
                <button onClick={() => scrollTo('sustainability')} className="py-3 text-left hover:text-white transition-colors">Sustainability</button>
                <button onClick={() => scrollTo('mission')} className="py-3 text-left hover:text-white transition-colors">Our Mission</button>
                <button onClick={() => { setMobileOpen(false); navigate('/auth'); }} className="mt-2 bg-white text-black py-3 rounded-full text-center font-medium">Get Early Access</button>
              </div>
            </div>
          )}
        </header>

        {/* ── Hero ── */}
        <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-20 text-center overflow-hidden">
          {/* Radial glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[500px] rounded-full bg-white/[0.02] blur-[100px]" />
          </div>
          {/* Grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

          <div className="relative z-10 flex flex-col items-center max-w-3xl animate-fade-in">
            <img src={bursLogo} alt="Burs" className="w-28 h-28 md:w-40 md:h-40 rounded-3xl object-contain mb-8" />

            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-[-0.03em] leading-[1.05]" style={{ fontFamily: "'Sora', sans-serif" }}>
              Rediscover Your<br />
              <span className="text-gray-500">Wardrobe with AI.</span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-gray-400 max-w-lg leading-relaxed animate-fade-in" style={{ animationDelay: '100ms' }}>
              Upload your closet. Let Burs style you. Save the planet by wearing what you already own.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <button onClick={() => navigate('/auth')} className="flex items-center justify-center gap-2 bg-white text-black h-14 px-8 rounded-full text-sm font-semibold tracking-wide hover:bg-gray-200 transition-all hover:scale-105">
                <Smartphone className="w-4 h-4" />
                Download for iOS
              </button>
              <button onClick={() => navigate('/auth')} className="flex items-center justify-center gap-2 border border-white/20 text-white h-14 px-8 rounded-full text-sm font-semibold tracking-wide hover:border-white/40 hover:bg-white/5 transition-all">
                <Smartphone className="w-4 h-4" />
                Download for Android
              </button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-gray-600 to-transparent" />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="px-6 py-28 md:py-40">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 text-center mb-4 animate-fade-in">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-20 animate-fade-in" style={{ fontFamily: "'Sora', sans-serif" }}>
              Three steps. Zero effort.
            </h2>

            {[
              { num: '01', icon: Shirt, title: 'Snap your clothes', desc: 'Point your camera at any garment. AI instantly tags color, material, and style — digitizing your closet in seconds.' },
              { num: '02', icon: Sparkles, title: 'AI works its magic', desc: 'Our neural styling engine learns your taste, checks weather and calendar, then generates perfect outfit combinations from pieces you own.' },
              { num: '03', icon: Heart, title: 'Wear & Care', desc: 'Breathe life into forgotten garments. Track what you wear, discover hidden gems, and fall in love with your wardrobe again.' },
            ].map((s, i) => (
              <div key={s.num} className="flex items-start gap-6 md:gap-10 py-10 border-t border-white/5 animate-fade-in" style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                <span className="text-6xl md:text-7xl font-bold text-white/[0.06] leading-none select-none shrink-0" style={{ fontFamily: "'Sora', sans-serif" }}>{s.num}</span>
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-3">
                    <s.icon className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                    <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed max-w-md">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sustainability ── */}
        <section id="sustainability" className="px-6 py-28 md:py-40 bg-white/[0.02]">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <Leaf className="w-8 h-8 mx-auto mb-8 text-gray-500" strokeWidth={1} />
            <blockquote className="text-2xl md:text-4xl font-bold tracking-tight leading-snug" style={{ fontFamily: "'Sora', sans-serif" }}>
              "The most sustainable garment<br className="hidden sm:block" /> is the one already in your closet."
            </blockquote>
            <p className="mt-8 text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
              Fast fashion accounts for 10% of global carbon emissions. Burs helps you shop less and style more — by making the most of what you already own.
            </p>

            <div className="mt-16 grid grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
              {[
                { stat: '80%', label: 'of clothes are under-worn' },
                { stat: '92M', label: 'tons of textile waste yearly' },
                { stat: '∞', label: 'outfits from your closet' },
              ].map(s => (
                <div key={s.label} className="bg-[#0a0a0a] p-6 md:p-10">
                  <div className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>{s.stat}</div>
                  <div className="text-xs text-gray-500 tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mission / Trust ── */}
        <section id="mission" className="px-6 py-28 md:py-40">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-gray-500 mb-4 animate-fade-in">Our Mission</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-20 animate-fade-in" style={{ fontFamily: "'Sora', sans-serif" }}>
              Built on trust.
            </h2>
            <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
              {[
                { icon: Shield, title: 'Privacy-first', desc: 'End-to-end encrypted. Your wardrobe data never leaves your control.' },
                { icon: Shield, title: 'Zero lock-in', desc: 'Export everything. Cancel anytime. No questions asked.' },
                { icon: Smartphone, title: 'Always on', desc: 'Offline-ready PWA. Your wardrobe is accessible anywhere, anytime.' },
              ].map((t, i) => (
                <div key={t.title} className="bg-[#0a0a0a] p-8 md:p-10 space-y-4 animate-fade-in" style={{ animationDelay: `${(i + 1) * 100}ms` }}>
                  <t.icon className="w-5 h-5 mx-auto text-gray-500" strokeWidth={1.5} />
                  <h3 className="font-semibold tracking-tight">{t.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-6 py-28 md:py-40">
          <div className="max-w-lg mx-auto text-center space-y-8 animate-fade-in">
            <img src={bursLogo} alt="Burs" className="w-14 h-14 mx-auto rounded-xl object-contain" />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Sora', sans-serif" }}>
              Join the movement.
            </h2>
            <p className="text-gray-400 text-sm tracking-wide">
              Dress smarter. Waste less. Rediscover your style with Burs.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 bg-white text-black h-14 px-12 rounded-full text-sm font-semibold tracking-widest uppercase hover:bg-gray-200 transition-all hover:scale-105"
            >
              Get Early Access
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-white/5 px-6 py-10">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-gray-500 tracking-wide">
            <div className="flex items-center gap-2">
              <img src={bursLogo} alt="Burs" className="w-5 h-5 rounded-sm object-contain" />
              <span className="text-white font-medium tracking-[0.12em]" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
            </div>
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="/contact" className="hover:text-white transition-colors">Contact</a>
            </div>
            <div className="flex items-center gap-5">
              <a href="#" aria-label="Instagram" className="hover:text-white transition-colors"><Instagram size={16} strokeWidth={1.5} /></a>
              <a href="#" aria-label="Twitter" className="hover:text-white transition-colors"><Twitter size={16} strokeWidth={1.5} /></a>
            </div>
            <span>© {new Date().getFullYear()} Burs</span>
          </div>
        </footer>
      </div>
    </>
  );
}
