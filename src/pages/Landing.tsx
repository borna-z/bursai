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
        <section className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden px-6 md:px-12 pt-20 pb-16">
          {/* Subtle background glow */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-center justify-between gap-16 relative z-10">
            {/* Left Column */}
            <div className="w-full md:w-1/2 flex flex-col items-start gap-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs tracking-wide text-gray-300 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Sustainable AI Styling
              </div>

              <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-white leading-[1.1]" style={{ fontFamily: "'Sora', sans-serif" }}>
                Rediscover <br className="hidden md:block" /> your wardrobe.
              </h1>

              <p className="text-lg md:text-xl text-gray-400 font-light max-w-lg leading-relaxed">
                Upload your clothes. Let Burs' AI generate daily outfit combinations from what you already own. Look great, save time, and reduce fast fashion.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4 animate-fade-in" style={{ animationDelay: '150ms' }}>
                <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-8 py-4 bg-white text-black rounded-full font-medium hover:scale-105 transition-transform duration-300 flex items-center justify-center gap-2">
                  Get Early Access
                  <ArrowRight size={18} strokeWidth={2} />
                </button>
                <button onClick={() => navigate('/auth')} className="w-full sm:w-auto px-8 py-4 border border-white/20 text-white rounded-full font-medium hover:bg-white/10 transition-colors duration-300 flex items-center justify-center gap-2">
                  <Smartphone size={18} strokeWidth={1.5} />
                  See The App
                </button>
              </div>
            </div>

            {/* Right Column: Phone Mockup */}
            <div className="w-full md:w-1/2 flex justify-center md:justify-end relative animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="relative w-[280px] h-[580px] md:w-[320px] md:h-[650px] bg-[#121212] rounded-[3rem] border-[6px] border-[#1e1e1e] overflow-hidden shadow-2xl shadow-black/50 transform md:rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-[#1e1e1e] rounded-b-3xl z-20" />
                <img src={bursLogo} alt="Burs App Interface" className="w-full h-full object-cover bg-gray-900" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 -z-10 bg-[#0f0f0f]">
                  <p className="text-gray-600 text-sm font-light">App Screenshot</p>
                </div>
              </div>
            </div>
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
