const ITEMS = [
  'AI-powered wardrobe intelligence',
  'Built for outfit planning',
  'Personal styling system',
  'Modern wardrobe clarity',
  'Mobile-first premium experience',
  'Sustainable fashion choices',
];

export function TrustStrip() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <section className="relative py-8 border-y border-[--lv2-border] overflow-hidden" aria-label="Trust signals">
      {/* Edge fade overlays */}
      <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--lv2-bg, #05070A), transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--lv2-bg, #05070A), transparent)' }} />

      <div className="lv2-marquee">
        {doubled.map((item, i) => (
          <span key={i} className="flex-shrink-0 flex items-center gap-6 px-6 text-[11px] tracking-[0.25em] uppercase whitespace-nowrap" style={{ color: 'var(--lv2-text-tertiary)' }}>
            {item}
            <span className="w-1 h-1 rounded-full bg-[--lv2-text-tertiary]" aria-hidden="true" />
          </span>
        ))}
      </div>
    </section>
  );
}
