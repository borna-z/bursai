export function OutfitBuilderSection() {
  const pieces = ['Blazer', 'White Tee', 'Dark Denim', 'Sneakers'];

  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Build looks with precision
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          Combine pieces, refine outfits, save favorites, and build a personal look library you'll actually use.
        </p>
      </div>

      <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        {/* Left — pieces */}
        <div className="space-y-3">
          {pieces.map((p, i) => (
            <div key={i} className={`lv2-card lv2-reveal lv2-reveal-delay-${i + 1} flex items-center gap-4 p-4`}>
              <div className="w-12 h-14 rounded-lg flex-shrink-0" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }} />
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--lv2-text-primary)' }}>{p}</span>
                <span className="block text-[10px] tracking-wider uppercase mt-0.5" style={{ color: 'var(--lv2-text-tertiary)' }}>Selected</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right — assembled result */}
        <div className="lv2-card lv2-reveal lv2-reveal-delay-3 lv2-premium-glow p-6 flex flex-col items-center">
          <div className="w-full aspect-[3/4] rounded-xl mb-4 flex items-center justify-center" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ border: '1px solid var(--lv2-border)' }}>
                <span className="text-xl" style={{ color: 'var(--lv2-cyan)' }}>✦</span>
              </div>
              <span className="text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>Complete Look</span>
            </div>
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--lv2-text-primary)' }}>Smart Casual Evening</span>
          <span className="text-[10px] tracking-wider uppercase mt-1" style={{ color: 'var(--lv2-text-tertiary)' }}>4 pieces · Saved</span>
        </div>
      </div>
    </section>
  );
}
