import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Sparkles, Calendar, Shirt, Camera, Sun, Shield, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import bursLogo from '@/assets/burs-logo.png';

const features = [
  {
    icon: Sparkles,
    title: 'AI Outfit Engine',
    desc: 'Neural styling that learns your taste and adapts to weather, occasion, and mood.',
  },
  {
    icon: Calendar,
    title: 'Calendar Sync',
    desc: 'Pulls your schedule and pre-styles every event — automatically.',
  },
  {
    icon: Shirt,
    title: 'Digital Wardrobe',
    desc: 'Snap, catalog, and track every piece. Your closet, digitized.',
  },
];

const steps = [
  { num: '01', icon: Camera, title: 'Capture', desc: 'Point your camera. AI tags color, material, and style in milliseconds.' },
  { num: '02', icon: Sun, title: 'Context', desc: 'Weather, calendar, occasion — all pulled in real-time.' },
  { num: '03', icon: Zap, title: 'Generate', desc: 'A complete outfit from your wardrobe, styled by AI, in seconds.' },
];

const trust = [
  { icon: Shield, title: 'Privacy-first', desc: 'End-to-end encrypted. Your data never leaves your control.' },
  { icon: Shield, title: 'Zero lock-in', desc: 'Export everything. Cancel anytime. No questions.' },
  { icon: Shield, title: 'Always on', desc: 'Offline-ready. Your wardrobe is always accessible.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>BURS | Your AI-Powered Personal Stylist</title>
        <meta name="description" content="BURS is your AI-powered personal stylist. Organize your wardrobe, plan outfits, and dress with confidence every day." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground overflow-hidden">

        {/* ── Hero ── */}
        <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
          {/* Radial glow behind logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
          </div>

          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />

          {/* Logo as hero */}
          <div className="relative animate-fade-in">
            <img
              src={bursLogo}
              alt="BURS"
              className="w-28 h-28 md:w-40 md:h-40 object-contain dark:invert"
            />
          </div>

          <h1
            className="mt-8 text-5xl md:text-7xl lg:text-8xl font-bold tracking-[-0.04em] leading-[0.95] max-w-3xl animate-fade-in animation-delay-100"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Style,<br />
            <span className="text-muted-foreground">automated.</span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-md animate-fade-in animation-delay-200 tracking-wide">
            AI-powered wardrobe management and outfit generation — built for the way you live.
          </p>

          <Button
            onClick={() => navigate('/auth')}
            size="lg"
            className="mt-10 h-14 px-12 text-sm font-semibold tracking-widest uppercase rounded-full animate-fade-in animation-delay-300"
          >
            Get Started
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/40 animate-fade-in animation-delay-300">
            <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-muted-foreground/30 to-transparent" />
          </div>
        </section>

        {/* ── Features ── */}
        <section className="px-6 py-28 md:py-40">
          <div className="max-w-5xl mx-auto">
            <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 animate-fade-in">
              Core Systems
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-20 animate-fade-in">
              Three engines. One platform.
            </h2>
            <div className="grid md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`bg-card p-8 md:p-10 space-y-5 animate-fade-in animation-delay-${(i + 1) * 100}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="px-6 py-28 md:py-40">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground text-center mb-4 animate-fade-in">
              Workflow
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-20 animate-fade-in">
              Three steps. Zero effort.
            </h2>
            <div className="space-y-0">
              {steps.map((s, i) => (
                <div
                  key={s.num}
                  className={`flex items-start gap-6 md:gap-10 py-10 border-t border-border animate-fade-in animation-delay-${(i + 1) * 100}`}
                >
                  <span className="text-6xl md:text-7xl font-bold text-border/60 leading-none select-none font-heading" style={{ fontFamily: "'Sora', sans-serif" }}>
                    {s.num}
                  </span>
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-3">
                      <s.icon className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="px-6 py-28 md:py-40">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-4 animate-fade-in">
              Principles
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-20 animate-fade-in">
              Built on trust.
            </h2>
            <div className="grid md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
              {trust.map((t, i) => (
                <div
                  key={t.title}
                  className={`bg-card p-8 md:p-10 space-y-4 animate-fade-in animation-delay-${(i + 1) * 100}`}
                >
                  <t.icon className="w-5 h-5 mx-auto text-muted-foreground" />
                  <h3 className="font-semibold tracking-tight">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-6 py-28 md:py-40">
          <div className="max-w-lg mx-auto text-center space-y-8 animate-fade-in">
            <img
              src={bursLogo}
              alt="BURS"
              className="w-12 h-12 mx-auto object-contain dark:invert"
            />
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Ready to upgrade<br />your routine?
            </h2>
            <p className="text-muted-foreground text-sm tracking-wide">
              Join thousands who dress smarter with BURS.
            </p>
            <Button
              onClick={() => navigate('/auth')}
              size="lg"
              className="h-14 px-12 text-sm font-semibold tracking-widest uppercase rounded-full"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-6 py-10 border-t border-border">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground tracking-wide">
            <div className="flex items-center gap-2">
              <img src={bursLogo} alt="BURS" className="w-5 h-5 object-contain dark:invert" />
              <span className="font-semibold text-foreground tracking-[0.12em]" style={{ fontFamily: "'Sora', sans-serif" }}>BURS</span>
            </div>
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
              <a href="/contact" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <span>© {new Date().getFullYear()} BURS</span>
          </div>
        </footer>
      </div>
    </>
  );
}
