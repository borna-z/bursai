const TESTIMONIALS = [
  { quote: 'Finally made my wardrobe feel usable.', name: 'A.K.', role: 'Creative Director' },
  { quote: 'Helps me choose better outfits faster.', name: 'M.L.', role: 'Product Designer' },
  { quote: 'The first wardrobe product that actually feels premium.', name: 'S.R.', role: 'Stylist' },
];

export function SocialProofSection() {
  return (
    <section className="relative py-24 md:py-32 px-6">
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
          Built for modern personal style
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
          For people who want more clarity, more consistency, and more value from what they already own.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t, i) => (
          <div key={i} className={`lv2-card lv2-reveal lv2-float lv2-float-delay-${i + 1} p-8`} style={{ transitionDelay: `${i * 120}ms` }}>
            <p className="text-base font-medium leading-relaxed mb-6" style={{ color: 'var(--lv2-text-primary)' }}>
              "{t.quote}"
            </p>
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--lv2-text-primary)' }}>{t.name}</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--lv2-text-tertiary)' }}>{t.role}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
