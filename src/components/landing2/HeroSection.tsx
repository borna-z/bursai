import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';

const EASE = [0.25, 0.1, 0.25, 1] as const;

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
      {/* Mesh gradient blobs */}
      <div className="lv2-mesh-blob lv2-mesh-blob--cyan" style={{ width: 600, height: 600, top: '-10%', right: '-10%' }} />
      <div className="lv2-mesh-blob lv2-mesh-blob--violet" style={{ width: 500, height: 500, bottom: '0%', left: '-5%' }} />
      <div className="lv2-mesh-blob lv2-mesh-blob--warm" style={{ width: 400, height: 400, top: '40%', left: '50%' }} />

      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => {
          const size = 1 + (i % 3);
          return (
            <div key={i} className="particle" style={{
              width: size, height: size,
              top: `${(i * 31 + 5) % 100}%`, left: `${(i * 47 + 13) % 100}%`,
              '--particle-opacity': 0.03 + (i % 4) * 0.025,
              '--tw-dur': `${3 + (i % 4) * 1.5}s`,
              '--dr-dur': `${8 + (i % 5) * 3}s`,
              '--delay': `${(i * 0.5) % 4}s`,
            } as React.CSSProperties} />
          );
        })}
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[--lv2-border] bg-[--lv2-surface] text-xs tracking-[0.2em] uppercase mb-8"
          style={{ color: 'var(--lv2-text-secondary)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[--lv2-cyan]" />
          AI wardrobe intelligence
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6"
          style={{ color: 'var(--lv2-text-primary)' }}
        >
          Your wardrobe, upgraded
          <br />
          to intelligence.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
          className="text-base sm:text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ color: 'var(--lv2-text-secondary)' }}
        >
          Digitize your wardrobe, generate better outfits, and plan what to wear with an AI stylist built around your real clothes.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
        >
          <button
            onClick={() => navigate('/auth')}
            className="lv2-cta-primary px-8 py-4 rounded-full text-sm font-semibold tracking-wide flex items-center gap-2"
          >
            Start Free <ArrowRight size={16} strokeWidth={2} />
          </button>
          <button
            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            className="lv2-cta-ghost px-8 py-4 rounded-full text-sm font-medium tracking-wide flex items-center gap-2"
          >
            <Play size={14} strokeWidth={2} /> Watch the Experience
          </button>
        </motion.div>

        {/* Micro text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-xs tracking-wide"
          style={{ color: 'var(--lv2-text-tertiary)' }}
        >
          No credit card required · Free plan available
        </motion.p>
      </div>

      {/* Floating product cards cluster */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none z-[5]" aria-hidden="true">
        {/* Left wardrobe card */}
        <div className="absolute left-[6%] top-[30%] lv2-float lv2-float-delay-1">
          <div className="lv2-glass-elevated rounded-xl p-3 w-36">
            <div className="w-full h-20 rounded-lg bg-gradient-to-br from-[--lv2-surface] to-[#15192280] mb-2" />
            <div className="h-2 w-20 rounded bg-[--lv2-border] mb-1" />
            <div className="h-1.5 w-14 rounded bg-[--lv2-border]" />
          </div>
        </div>

        {/* Right AI card */}
        <div className="absolute right-[6%] top-[28%] lv2-float lv2-float-delay-2">
          <div className="lv2-glass-elevated rounded-xl p-3 w-40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-[--lv2-cyan]" style={{ opacity: 0.3 }} />
              <div className="h-2 w-16 rounded bg-[--lv2-border]" />
            </div>
            <div className="h-1.5 w-full rounded bg-[--lv2-border] mb-1" />
            <div className="h-1.5 w-24 rounded bg-[--lv2-border]" />
          </div>
        </div>

        {/* Bottom planner strip */}
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 lv2-float lv2-float-delay-3">
          <div className="lv2-glass-elevated rounded-xl p-2.5 flex gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
              <div key={d} className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center text-[9px] tracking-wider ${i === 2 ? 'border border-[--lv2-cyan]' : ''}`} style={{ background: 'var(--lv2-surface)', color: i === 2 ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)' }}>
                <span className="font-medium">{d}</span>
                <div className="w-5 h-5 rounded bg-[--lv2-border] mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
