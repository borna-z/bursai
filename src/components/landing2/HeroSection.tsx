import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { motion } from 'framer-motion';

const EASE = [0.25, 0.1, 0.25, 1] as const;

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-20 overflow-hidden">
      {/* Mesh gradient blobs */}
      <div className="lv2-mesh-blob lv2-mesh-blob--cyan" style={{ width: 700, height: 700, top: '-15%', right: '-15%' }} />
      <div className="lv2-mesh-blob lv2-mesh-blob--violet" style={{ width: 600, height: 600, bottom: '-5%', left: '-10%' }} />
      <div className="lv2-mesh-blob lv2-mesh-blob--warm" style={{ width: 500, height: 500, top: '35%', left: '45%' }} />

      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => {
          const size = 1 + (i % 3);
          return (
            <div key={i} className="particle" style={{
              width: size, height: size,
              top: `${(i * 31 + 5) % 100}%`, left: `${(i * 47 + 13) % 100}%`,
              '--particle-opacity': 0.03 + (i % 4) * 0.02,
              '--tw-dur': `${3 + (i % 4) * 1.5}s`,
              '--dr-dur': `${8 + (i % 5) * 3}s`,
              '--delay': `${(i * 0.5) % 4}s`,
            } as React.CSSProperties} />
          );
        })}
      </div>

      {/* Light beam */}
      <div className="lv2-light-beam absolute inset-0 pointer-events-none" aria-hidden="true" />

      {/* Bottom vignette */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" style={{ background: 'linear-gradient(to top, #05070A, transparent)' }} aria-hidden="true" />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[--lv2-border] bg-[--lv2-surface] text-[11px] tracking-[0.25em] uppercase mb-4"
          style={{ color: 'var(--lv2-text-secondary)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[--lv2-cyan] animate-pulse" />
          AI wardrobe intelligence
        </motion.div>

        {/* Visual anchor line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
          className="w-10 h-px mx-auto mb-10"
          style={{ background: 'linear-gradient(90deg, transparent, var(--lv2-cyan), transparent)' }}
        />

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.4 }}
          className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight leading-[1.04] mb-7"
          style={{ color: 'var(--lv2-text-primary)' }}
        >
          Your wardrobe, upgraded
          <br />
          to <span className="lv2-text-gradient">intelligence</span>.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
          className="text-base sm:text-lg md:text-xl max-w-xl mx-auto mb-12 leading-[1.7]"
          style={{ color: 'var(--lv2-text-secondary)' }}
        >
          Digitize your wardrobe, generate better outfits, and plan what to wear with an AI stylist built around your real clothes.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 1.0 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-7"
        >
          <button
            onClick={() => navigate('/auth')}
            className="lv2-cta-primary px-10 py-4 rounded-full text-sm font-semibold tracking-wide flex items-center gap-2"
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
          transition={{ duration: 0.6, delay: 1.3 }}
          className="text-xs tracking-wide"
          style={{ color: 'var(--lv2-text-tertiary)' }}
        >
          No credit card required · Free plan available
        </motion.p>
      </div>

      {/* Floating product cards cluster */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none z-[5]" aria-hidden="true">
        {/* Left wardrobe card */}
        <motion.div
          initial={{ opacity: 0, y: 30, x: -20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 1.0 }}
          className="absolute left-[5%] top-[28%] lv2-float lv2-float-delay-1"
        >
          <div className="lv2-glass-elevated rounded-xl p-3.5 w-40">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#1ED0E7' }} />
              <span className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>Wardrobe</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {['#2a3040', '#4a3828', '#1a2535', '#3a2a20', '#252832', '#1e2a3a'].map((c, i) => (
                <div key={i} className="aspect-square rounded-md" style={{ background: c }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[9px]" style={{ color: 'var(--lv2-text-tertiary)' }}>24 pieces</span>
            </div>
          </div>
        </motion.div>

        {/* Right AI card */}
        <motion.div
          initial={{ opacity: 0, y: 30, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 1.2 }}
          className="absolute right-[5%] top-[26%] lv2-float lv2-float-delay-2"
        >
          <div className="lv2-glass-elevated rounded-xl p-3.5 w-44">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: 'rgba(30,208,231,0.15)', color: 'var(--lv2-cyan)' }}>B</div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--lv2-text-primary)' }}>AI Stylist</span>
            </div>
            <div className="rounded-lg p-2 mb-1.5" style={{ background: 'var(--lv2-surface)' }}>
              <span className="text-[10px] leading-relaxed" style={{ color: 'var(--lv2-text-secondary)' }}>Try your navy blazer with the white tee and…</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-7 h-8 rounded" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bottom planner strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 1.4 }}
          className="absolute bottom-[13%] left-1/2 -translate-x-1/2 lv2-float lv2-float-delay-3"
        >
          <div className="lv2-glass-elevated rounded-xl p-2.5 flex gap-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
              <div key={d} className={`w-14 h-16 rounded-lg flex flex-col items-center justify-center text-[9px] tracking-wider ${i === 2 ? 'border border-[--lv2-cyan]' : ''}`} style={{ background: 'var(--lv2-surface)', color: i === 2 ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)' }}>
                <span className="font-medium">{d}</span>
                <div className="w-6 h-6 rounded mt-1" style={{ background: i === 2 ? 'rgba(30,208,231,0.1)' : 'var(--lv2-border)' }} />
                {i === 2 && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: 'var(--lv2-cyan)' }} />}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
