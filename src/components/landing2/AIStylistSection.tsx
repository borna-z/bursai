const PROMPTS = [
  'What should I wear tomorrow?',
  'Build a dinner outfit',
  'Pack for 3 days in Paris',
  'Style this black jacket',
  'Plan my workweek',
];

const POSITIONS = [
  { top: '12%', left: '5%' },
  { top: '8%', right: '3%' },
  { bottom: '25%', left: '2%' },
  { bottom: '18%', right: '5%' },
  { top: '50%', right: '0%' },
];

export function AIStylistSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden" id="ai-stylist">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(30,208,231,0.12) 0%, rgba(139,124,255,0.06) 50%, transparent 70%)' }} />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10 mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Meet your AI stylist
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-xl mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          Not generic fashion advice. BURS helps you style from your real wardrobe, your routines, your occasions, and your personal taste.
        </p>
      </div>

      <div className="relative max-w-lg mx-auto" style={{ minHeight: 480 }}>
        {/* Phone with chat UI */}
        <div className="lv2-phone mx-auto lv2-glow-breathe relative z-10">
          <div className="lv2-phone-notch" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--lv2-cyan)', color: 'var(--lv2-bg)' }}>B</div>
              <span className="text-xs font-medium" style={{ color: 'var(--lv2-text-primary)' }}>BURS Stylist</span>
            </div>
            {/* User message */}
            <div className="ml-auto max-w-[75%] px-3 py-2 rounded-2xl rounded-br-sm text-xs" style={{ background: 'rgba(30,208,231,0.12)', color: 'var(--lv2-text-primary)' }}>
              What should I wear to dinner tonight?
            </div>
            {/* AI response */}
            <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm text-xs leading-relaxed" style={{ background: 'var(--lv2-surface)', color: 'var(--lv2-text-secondary)' }}>
              Based on your wardrobe, I'd suggest your navy blazer with the white linen shirt and dark trousers. <span className="lv2-cursor" />
            </div>
            {/* Mini outfit preview */}
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-12 h-14 rounded-lg" style={{ background: 'var(--lv2-surface-elevated)', border: '1px solid var(--lv2-border)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Floating prompt chips */}
        {PROMPTS.map((p, i) => (
          <div
            key={i}
            className={`hidden md:block absolute lv2-float lv2-float-delay-${(i % 3) + 1} px-4 py-2 rounded-full text-xs whitespace-nowrap`}
            style={{
              ...POSITIONS[i],
              background: 'var(--lv2-surface)',
              border: '1px solid var(--lv2-border)',
              color: 'var(--lv2-text-secondary)',
            }}
          >
            {p}
          </div>
        ))}
      </div>
    </section>
  );
}
