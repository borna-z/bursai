const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OCCASIONS = ['Office', 'Meeting', 'Casual', 'Client', 'Remote', 'Dinner', 'Weekend'];
const OUTFIT_COLORS = [
  ['#2a3040', '#e8e4de'],
  ['#1a2535', '#c8bfb0'],
  ['#3a2a20', '#f0ece6'],
  ['#1a1e28', '#e8e4de'],
  ['#252832', '#c4b8a0'],
  ['#4a3828', '#e0dcd4'],
  ['#2a3040', '#b0a48c'],
];

export function WeeklyPlannerSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      {/* Background gradient strip */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[60%] pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(30,208,231,0.02) 50%, transparent 100%)' }} aria-hidden="true" />

      <div className="max-w-4xl mx-auto text-center mb-20 relative z-10">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>Weekly planner</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Plan less. Wear better.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          Turn your week into a clean visual wardrobe flow.
        </p>
      </div>

      <div className="max-w-4xl mx-auto overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide relative z-10">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-1/2 left-6 right-6 h-px" style={{ background: 'var(--lv2-border)' }} aria-hidden="true" />

        <div className="flex gap-3 md:grid md:grid-cols-7 md:gap-4 min-w-[640px] md:min-w-0">
          {DAYS.map((day, i) => {
            const isActive = i === 2;
            return (
              <div
                key={day}
                className={`lv2-card lv2-reveal flex-shrink-0 w-[100px] md:w-auto p-4 flex flex-col items-center gap-3 ${isActive ? 'lv2-glow-breathe' : ''}`}
                style={{
                  transitionDelay: `${i * 100}ms`,
                  borderColor: isActive ? 'var(--lv2-cyan)' : undefined,
                  transform: isActive ? 'scale(1.04)' : undefined,
                  zIndex: isActive ? 2 : 1,
                }}
              >
                <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: isActive ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)' }}>
                  {day}
                </span>
                {/* Mini outfit squares */}
                <div className="w-full aspect-square rounded-lg flex items-center justify-center gap-1 p-1.5" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }}>
                  {OUTFIT_COLORS[i].map((c, j) => (
                    <div key={j} className="flex-1 h-full rounded" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>
                  {OCCASIONS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
