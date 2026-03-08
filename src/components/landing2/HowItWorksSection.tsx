import { Upload, Shirt, Calendar } from 'lucide-react';

const STEPS = [
  { num: '01', icon: Upload, title: 'Upload your wardrobe', desc: 'Snap photos or import from links. BURS digitizes every piece.' },
  { num: '02', icon: Shirt, title: 'Build and save better outfits', desc: 'Combine pieces manually or let AI suggest complete looks.' },
  { num: '03', icon: Calendar, title: 'Plan your week with AI support', desc: 'Assign outfits to days and eliminate morning decision fatigue.' },
];

export function HowItWorksSection() {
  return (
    <section className="relative py-24 md:py-32 px-6" id="how-it-works">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          From closet to clarity in three steps
        </h2>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
        {STEPS.map((s, i) => (
          <div key={i} className={`lv2-card lv2-shimmer-border lv2-reveal lv2-reveal-delay-${i + 1} relative p-8 text-center group`}>
            {/* Large faded number */}
            <span className="absolute top-4 right-6 text-5xl font-bold pointer-events-none" style={{ color: 'var(--lv2-border)', opacity: 0.5 }}>{s.num}</span>

            {/* Orbit ring */}
            <div className="lv2-orbit-ring w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <s.icon size={24} strokeWidth={1.5} style={{ color: 'var(--lv2-cyan)' }} />
            </div>

            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--lv2-text-primary)' }}>{s.title}</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--lv2-text-secondary)' }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
