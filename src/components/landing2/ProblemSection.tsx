import { Layers, Eye, Palette } from 'lucide-react';

const CARDS = [
  {
    icon: Layers,
    title: 'Too much friction',
    desc: 'You own enough. But choosing what to wear still takes too much effort every morning.',
  },
  {
    icon: Eye,
    title: 'Good pieces get forgotten',
    desc: 'Great clothes disappear into the background and rarely get used properly.',
  },
  {
    icon: Palette,
    title: 'Style becomes inconsistent',
    desc: 'Without structure, your wardrobe never becomes as useful as it should be.',
  },
];

export function ProblemSection() {
  return (
    <section className="relative py-32 md:py-44 px-6 overflow-hidden">
      {/* Watermark */}
      <div className="lv2-watermark top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        THE PROBLEM
      </div>

      <div className="max-w-4xl mx-auto text-center mb-20 relative z-10">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>The problem</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Most wardrobes are full.<br />Most people still have nothing to wear.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          The issue is not always what you own. It's memory, friction, and the lack of a system.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5 relative z-10">
        {CARDS.map((c, i) => (
          <div key={i} className={`lv2-card lv2-shimmer-border lv2-accent-top lv2-hover-lift lv2-reveal lv2-reveal-delay-${i + 2} p-8 md:p-10`}>
            <c.icon size={22} strokeWidth={1.5} className="mb-6" style={{ color: 'var(--lv2-cyan)' }} />
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--lv2-text-primary)' }}>{c.title}</h3>
            <p className="text-sm leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
