import { Upload, Shirt, Calendar } from 'lucide-react';

const STEPS = [
  { num: '01', icon: Upload, title: 'Upload your wardrobe', desc: 'Snap photos or import from links. BURS digitizes every piece.' },
  { num: '02', icon: Shirt, title: 'Build and save better outfits', desc: 'Combine pieces manually or let AI suggest complete looks.' },
  { num: '03', icon: Calendar, title: 'Plan your week with AI support', desc: 'Assign outfits to days and eliminate morning decision fatigue.' },
];

export function HowItWorksSection() {
  return (
    <section className="relative py-28 md:py-40 px-6" id="how-it-works">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>How it works</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          From closet to clarity in three steps
        </h2>
      </div>

      <div className="max-w-4xl mx-auto relative">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px -translate-y-1/2" style={{ background: 'linear-gradient(90deg, transparent, var(--lv2-border), var(--lv2-border), transparent)' }} aria-hidden="true">
          {/* Dots at intersections */}
          <div className="absolute left-[16.66%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--lv2-cyan)', boxShadow: '0 0 8px rgba(30,208,231,0.3)' }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--lv2-cyan)', boxShadow: '0 0 8px rgba(30,208,231,0.3)' }} />
          <div className="absolute right-[16.66%] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--lv2-cyan)', boxShadow: '0 0 8px rgba(30,208,231,0.3)' }} />
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative z-10">
          {STEPS.map((s, i) => (
            <div key={i} className={`lv2-card lv2-shimmer-border lv2-hover-lift lv2-reveal lv2-reveal-delay-${i + 1} relative p-8 md:p-10 text-center`}>
              {/* Large faded number */}
              <span className="absolute top-3 right-5 text-8xl font-bold pointer-events-none select-none lv2-text-gradient" style={{ opacity: 0.06 }}>{s.num}</span>

              {/* Top light gradient */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-xl" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

              {/* Orbit ring */}
              <div className="lv2-orbit-ring w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <s.icon size={24} strokeWidth={1.5} style={{ color: 'var(--lv2-cyan)' }} />
              </div>

              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--lv2-text-primary)' }}>{s.title}</h3>
              <p className="text-sm leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
