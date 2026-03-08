import { useEffect, useRef, useState } from 'react';
import { Upload, FolderOpen, Shirt, MessageSquare, Calendar } from 'lucide-react';

const FEATURES = [
  { id: 'digitize', icon: Upload, label: 'Digitize', title: 'Digitize', desc: 'Upload your wardrobe and turn your clothing into a visual system.', mockLabel: 'Wardrobe Upload' },
  { id: 'organize', icon: FolderOpen, label: 'Organize', title: 'Organize', desc: 'Sort by category, season, occasion, color, fit, and personal context.', mockLabel: 'Smart Filters' },
  { id: 'build', icon: Shirt, label: 'Build', title: 'Build', desc: 'Create complete outfits from your real wardrobe and save the looks that work.', mockLabel: 'Outfit Builder' },
  { id: 'ask-ai', icon: MessageSquare, label: 'Ask AI', title: 'Ask AI', desc: 'Get suggestions, combinations, styling help, and wardrobe guidance.', mockLabel: 'AI Stylist' },
  { id: 'plan', icon: Calendar, label: 'Plan', title: 'Plan', desc: 'Build a weekly outfit flow and reduce daily decision fatigue.', mockLabel: 'Weekly Planner' },
];

export function SystemSection() {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number(e.target.getAttribute('data-idx'));
            if (!isNaN(idx)) setActive(idx);
          }
        });
      },
      { threshold: 0.5 }
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const feat = FEATURES[active];

  return (
    <section className="relative py-24 md:py-32 px-6" id="features">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="lv2-reveal text-3xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'var(--lv2-text-primary)' }}>
            A wardrobe system,<br />not just a wardrobe app
          </h2>
          <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg max-w-lg mx-auto" style={{ color: 'var(--lv2-text-secondary)' }}>
            BURS turns clothing into structure, clarity, and daily styling support.
          </p>
        </div>

        <div className="md:grid md:grid-cols-[240px_1fr] md:gap-12">
          {/* Left nav — sticky on desktop */}
          <div className="hidden md:block">
            <div className="sticky top-32 space-y-1">
              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 text-left"
                  style={{
                    color: active === i ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)',
                    background: active === i ? 'rgba(30, 208, 231, 0.06)' : 'transparent',
                  }}
                >
                  <f.icon size={18} strokeWidth={1.5} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right — scrollable feature panels */}
          <div className="space-y-8 md:space-y-0">
            {FEATURES.map((f, i) => (
              <div
                key={f.id}
                ref={(el) => { sectionRefs.current[i] = el; }}
                data-idx={i}
                className="min-h-[50vh] md:min-h-[70vh] flex flex-col md:flex-row items-center gap-8 md:gap-12 py-12"
              >
                {/* Phone mockup */}
                <div className="flex-shrink-0">
                  <div className="lv2-phone lv2-scan-line mx-auto" style={{ opacity: active === i ? 1 : 0.4, transition: 'opacity 0.5s ease' }}>
                    <div className="lv2-phone-notch" />
                    <div className="p-4 flex flex-col items-center justify-center h-full">
                      <f.icon size={28} strokeWidth={1.5} style={{ color: 'var(--lv2-cyan)', marginBottom: 12 }} />
                      <span className="text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--lv2-text-tertiary)' }}>{f.mockLabel}</span>
                      <div className="mt-4 space-y-2 w-full">
                        <div className="h-2 w-full rounded bg-[--lv2-border]" />
                        <div className="h-2 w-3/4 rounded bg-[--lv2-border]" />
                        <div className="h-2 w-1/2 rounded bg-[--lv2-border]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div>
                  {/* Mobile label */}
                  <div className="md:hidden flex items-center gap-2 mb-3" style={{ color: 'var(--lv2-cyan)' }}>
                    <f.icon size={16} strokeWidth={1.5} />
                    <span className="text-xs tracking-[0.15em] uppercase font-medium">{f.label}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: 'var(--lv2-text-primary)' }}>{f.title}</h3>
                  <p className="text-base leading-relaxed max-w-md" style={{ color: 'var(--lv2-text-secondary)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
