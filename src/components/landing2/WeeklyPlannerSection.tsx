const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const OCCASIONS = ['Office', 'Meeting', 'Casual', 'Client', 'Remote', 'Dinner', 'Weekend'];

export function WeeklyPlannerSection() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Plan less. Wear better.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          Turn your week into a clean visual wardrobe flow.
        </p>
      </div>

      <div className="max-w-4xl mx-auto overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
        <div className="flex gap-3 md:grid md:grid-cols-7 md:gap-4 min-w-[640px] md:min-w-0">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={`lv2-card lv2-reveal flex-shrink-0 w-[100px] md:w-auto p-4 flex flex-col items-center gap-3 ${i === 2 ? 'lv2-glow-breathe' : ''}`}
              style={{
                transitionDelay: `${i * 80}ms`,
                borderColor: i === 2 ? 'var(--lv2-cyan)' : undefined,
              }}
            >
              <span className="text-[10px] tracking-[0.2em] uppercase font-medium" style={{ color: i === 2 ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)' }}>
                {day}
              </span>
              <div className="w-full aspect-square rounded-lg" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)' }} />
              <span className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>
                {OCCASIONS[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
