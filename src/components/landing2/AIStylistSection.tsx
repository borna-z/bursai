const PROMPTS = [
  'What should I wear tomorrow?',
  'Build a dinner outfit',
  'Pack for 3 days in Paris',
  'Style this black jacket',
  'Plan my workweek',
];

const POSITIONS = [
  { top: '10%', left: '3%' },
  { top: '6%', right: '1%' },
  { bottom: '28%', left: '0%' },
  { bottom: '15%', right: '3%' },
  { top: '50%', right: '-2%' },
];

export function AIStylistSection() {
  return (
    <section className="relative py-32 md:py-44 px-6 overflow-hidden" id="ai-stylist">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(30,208,231,0.14) 0%, rgba(139,124,255,0.07) 50%, transparent 70%)' }} />
      </div>

      {/* Radial grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

      <div className="max-w-4xl mx-auto text-center relative z-10 mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>AI Stylist</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Meet your <span className="lv2-text-gradient">AI stylist</span>
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-xl mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          Not generic fashion advice. BURS helps you style from your real wardrobe, your routines, your occasions, and your personal taste.
        </p>
      </div>

      <div className="relative max-w-lg mx-auto" style={{ minHeight: 520 }}>
        {/* Phone with chat UI */}
        <div className="lv2-phone mx-auto lv2-glow-breathe relative z-10">
          <div className="lv2-phone-notch" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'rgba(30,208,231,0.15)', color: 'var(--lv2-cyan)' }}>B</div>
              <span className="text-xs font-medium" style={{ color: 'var(--lv2-text-primary)' }}>BURS Stylist</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 ml-auto" />
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
              {['#2a3040', '#e8e4de', '#1a1e28'].map((c, i) => (
                <div key={i} className="w-12 h-14 rounded-lg" style={{ background: c, border: '1px solid var(--lv2-border)' }} />
              ))}
            </div>
          </div>
        </div>

        {/* Offset second phone (outfit result) */}
        <div className="hidden md:block absolute -right-16 top-16 z-[5] opacity-60" style={{ transform: 'scale(0.75)' }}>
          <div className="lv2-phone">
            <div className="lv2-phone-notch" />
            <div className="p-4 flex flex-col items-center justify-center h-full">
              <span className="text-[10px] tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--lv2-text-tertiary)' }}>Outfit Result</span>
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {['#2a3040', '#e8e4de', '#1a1e28', '#3a2a20'].map((c, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg" style={{ background: c, border: '1px solid var(--lv2-border)' }} />
                ))}
              </div>
              <span className="text-[9px] mt-3" style={{ color: 'var(--lv2-cyan)' }}>✦ Dinner Evening</span>
            </div>
          </div>
        </div>

        {/* Floating prompt chips */}
        {PROMPTS.map((p, i) => (
          <div
            key={i}
            className={`hidden md:block absolute lv2-float lv2-float-delay-${(i % 3) + 1} px-5 py-2.5 rounded-full text-xs whitespace-nowrap transition-all duration-300 hover:border-[--lv2-cyan] hover:shadow-[0_0_20px_rgba(30,208,231,0.1)]`}
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
