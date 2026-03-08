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
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Most wardrobes are full.<br />Most people still have nothing to wear.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          The issue is not always what you own. It's memory, friction, and the lack of a system.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
        {CARDS.map((c, i) => (
          <div key={i} className={`lv2-card lv2-shimmer-border lv2-reveal lv2-reveal-delay-${i + 2} p-6 md:p-8`}>
            <c.icon size={22} strokeWidth={1.5} className="mb-5" style={{ color: 'var(--lv2-text-tertiary)' }} />
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--lv2-text-primary)' }}>{c.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--lv2-text-secondary)' }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
