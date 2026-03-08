const PIECES = [
  { name: 'Blazer', color: '#1a2535' },
  { name: 'White Tee', color: '#e8e4de' },
  { name: 'Dark Denim', color: '#1a1e28' },
  { name: 'Sneakers', color: '#f0ece6' },
];

export function OutfitBuilderSection() {
  return (
    <section className="relative py-28 md:py-40 px-6">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>Outfit builder</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Build looks with precision
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          Combine pieces, refine outfits, save favorites, and build a personal look library you'll actually use.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-center">
        {/* Left — pieces */}
        <div className="space-y-3 relative">
          {PIECES.map((p, i) => (
            <div key={i} className={`lv2-card lv2-hover-lift lv2-reveal lv2-reveal-delay-${i + 1} flex items-center gap-4 p-4`}>
              <div className="relative">
                <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--lv2-cyan)', color: 'var(--lv2-bg)' }}>{i + 1}</span>
                <div className="w-12 h-14 rounded-lg flex-shrink-0" style={{ background: p.color, border: '1px solid var(--lv2-border)' }} />
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--lv2-text-primary)' }}>{p.name}</span>
                <span className="block text-[10px] tracking-wider uppercase mt-0.5" style={{ color: 'var(--lv2-text-tertiary)' }}>Selected</span>
              </div>
            </div>
          ))}

          {/* SVG connector line */}
          <svg className="hidden md:block absolute -right-12 top-1/2 -translate-y-1/2 w-12 h-40" aria-hidden="true">
            <line x1="0" y1="20" x2="48" y2="80" stroke="var(--lv2-border)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="60" x2="48" y2="80" stroke="var(--lv2-border)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="100" x2="48" y2="80" stroke="var(--lv2-border)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="0" y1="130" x2="48" y2="80" stroke="var(--lv2-border)" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Right — assembled result */}
        <div className="lv2-card lv2-reveal lv2-reveal-delay-3 lv2-premium-glow p-6 flex flex-col items-center">
          <div className="w-full aspect-[3/4] rounded-xl mb-4 flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }}>
            <div className="grid grid-cols-2 gap-2 p-4 w-full h-full">
              {PIECES.map((p, i) => (
                <div key={i} className="rounded-lg" style={{ background: p.color, border: '1px solid var(--lv2-border)' }} />
              ))}
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--lv2-text-primary)' }}>Smart Casual Evening</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] tracking-wider uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>4 pieces</span>
            <span className="text-[10px]" style={{ color: 'var(--lv2-cyan)' }}>✓ Saved</span>
          </div>
        </div>
      </div>
    </section>
  );
}
