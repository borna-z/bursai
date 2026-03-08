const TESTIMONIALS = [
  { quote: 'Finally made my wardrobe feel usable.', name: 'A.K.', role: 'Creative Director' },
  { quote: 'Helps me choose better outfits faster.', name: 'M.L.', role: 'Product Designer' },
  { quote: 'The first wardrobe product that actually feels premium.', name: 'S.R.', role: 'Stylist' },
];

export function SocialProofSection() {
  return (
    <section className="relative py-32 md:py-44 px-6">
      <div className="max-w-4xl mx-auto text-center mb-20">
        <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>What people say</p>
        <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Built for modern personal style
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          For people who want more clarity, more consistency, and more value from what they already own.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-5">
        {TESTIMONIALS.map((t, i) => (
          <div key={i} className={`lv2-card lv2-accent-top lv2-reveal lv2-reveal-delay-${i + 2} p-8 relative`}>
            {/* Decorative quote */}
            <span className="lv2-quote-mark" aria-hidden="true">"</span>
            <p className="text-base font-medium leading-relaxed mb-6 mt-6" style={{ color: 'var(--lv2-text-primary)' }}>
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
