import { useEffect, useRef, useState } from 'react';
import { Upload, FolderOpen, Shirt, MessageSquare, Calendar } from 'lucide-react';

const FEATURES = [
  {
    id: 'digitize', icon: Upload, label: 'Digitize', title: 'Digitize', desc: 'Upload your wardrobe and turn your clothing into a visual system.',
    mockContent: (
      <div className="p-3 space-y-2 w-full">
        <div className="grid grid-cols-3 gap-1.5">
          {['#2a3040','#4a3828','#1a2535','#3a2a20','#252832','#1e2a3a'].map((c,i) => (
            <div key={i} className="aspect-square rounded-lg" style={{ background: c, border: '1px solid var(--lv2-border)' }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[9px]" style={{ color: 'var(--lv2-text-tertiary)' }}>6 uploaded</span>
        </div>
      </div>
    ),
  },
  {
    id: 'organize', icon: FolderOpen, label: 'Organize', title: 'Organize', desc: 'Sort by category, season, occasion, color, fit, and personal context.',
    mockContent: (
      <div className="p-3 space-y-2 w-full">
        <div className="flex flex-wrap gap-1.5">
          {['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Spring'].map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: 'var(--lv2-surface)', border: '1px solid var(--lv2-border)', color: 'var(--lv2-text-secondary)' }}>{t}</span>
          ))}
        </div>
        <div className="h-1.5 w-full rounded bg-[--lv2-border]" />
        <div className="h-1.5 w-3/4 rounded bg-[--lv2-border]" />
      </div>
    ),
  },
  {
    id: 'build', icon: Shirt, label: 'Build', title: 'Build', desc: 'Create complete outfits from your real wardrobe and save the looks that work.',
    mockContent: (
      <div className="p-3 w-full">
        <div className="grid grid-cols-2 gap-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-[3/4] rounded-lg" style={{ background: i === 1 ? '#2a3040' : i === 2 ? '#4a3828' : i === 3 ? '#1a2535' : '#252832', border: '1px solid var(--lv2-border)' }} />
          ))}
        </div>
        <div className="mt-2 text-center">
          <span className="text-[9px] tracking-wider uppercase" style={{ color: 'var(--lv2-cyan)' }}>✦ Complete Look</span>
        </div>
      </div>
    ),
  },
  {
    id: 'ask-ai', icon: MessageSquare, label: 'Ask AI', title: 'Ask AI', desc: 'Get suggestions, combinations, styling help, and wardrobe guidance.',
    mockContent: (
      <div className="p-3 space-y-2 w-full">
        <div className="ml-auto max-w-[80%] px-2.5 py-1.5 rounded-xl rounded-br-sm text-[9px]" style={{ background: 'rgba(30,208,231,0.12)', color: 'var(--lv2-text-primary)' }}>
          What should I wear?
        </div>
        <div className="max-w-[85%] px-2.5 py-1.5 rounded-xl rounded-bl-sm text-[9px]" style={{ background: 'var(--lv2-surface)', color: 'var(--lv2-text-secondary)' }}>
          Try the navy blazer with white tee…
        </div>
      </div>
    ),
  },
  {
    id: 'plan', icon: Calendar, label: 'Plan', title: 'Plan', desc: 'Build a weekly outfit flow and reduce daily decision fatigue.',
    mockContent: (
      <div className="p-3 w-full">
        <div className="flex gap-1">
          {['M','T','W','T','F'].map((d,i) => (
            <div key={i} className={`flex-1 rounded-lg py-1.5 flex flex-col items-center gap-1 ${i === 2 ? 'border border-[--lv2-cyan]' : ''}`} style={{ background: 'var(--lv2-surface)' }}>
              <span className="text-[8px]" style={{ color: i === 2 ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)' }}>{d}</span>
              <div className="w-4 h-4 rounded" style={{ background: 'var(--lv2-border)' }} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const GLOW_COLORS = [
  'rgba(30, 208, 231, 0.08)',
  'rgba(30, 208, 231, 0.06)',
  'rgba(139, 124, 255, 0.08)',
  'rgba(139, 124, 255, 0.1)',
  'rgba(30, 208, 231, 0.07)',
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
    <section className="relative py-28 md:py-40 px-6" id="features">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-20">
          <p className="lv2-reveal text-[11px] tracking-[0.25em] uppercase mb-5" style={{ color: 'var(--lv2-text-tertiary)' }}>The system</p>
          <h2 className="lv2-reveal lv2-reveal-delay-1 text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
            A wardrobe system,<br />not just a wardrobe app
          </h2>
          <p className="lv2-reveal lv2-reveal-delay-2 text-base md:text-lg max-w-lg mx-auto leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
            BURS turns clothing into structure, clarity, and daily styling support.
          </p>
        </div>

        <div className="md:grid md:grid-cols-[260px_1fr] md:gap-12">
          {/* Left nav — sticky on desktop */}
          <div className="hidden md:block">
            <div className="sticky top-32 space-y-0 relative">
              {/* Vertical progress line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-px" style={{ background: 'var(--lv2-border)' }}>
                <div
                  className="w-full rounded-full transition-all duration-500"
                  style={{
                    background: 'var(--lv2-cyan)',
                    height: `${((active + 1) / FEATURES.length) * 100}%`,
                  }}
                />
              </div>

              {FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-sm font-medium transition-all duration-400 text-left relative"
                  style={{
                    color: active === i ? 'var(--lv2-cyan)' : 'var(--lv2-text-tertiary)',
                    background: active === i ? 'rgba(30, 208, 231, 0.06)' : 'transparent',
                  }}
                >
                  <span className="text-[10px] tracking-wider font-mono opacity-50">{String(i + 1).padStart(2, '0')}</span>
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
                className="min-h-[50vh] md:min-h-[70vh] flex flex-col md:flex-row items-center gap-8 md:gap-16 py-12"
              >
                {/* Phone mockup with glow ring */}
                <div className="flex-shrink-0 relative">
                  {/* Glow ring */}
                  <div
                    className="absolute inset-0 rounded-[2.5rem] transition-all duration-700"
                    style={{
                      boxShadow: active === i ? `0 0 80px ${GLOW_COLORS[i]}, 0 0 120px ${GLOW_COLORS[i]}` : 'none',
                      opacity: active === i ? 1 : 0,
                    }}
                  />
                  <div className="lv2-phone lv2-scan-line mx-auto" style={{ opacity: active === i ? 1 : 0.3, transition: 'opacity 0.6s ease' }}>
                    <div className="lv2-phone-notch" />
                    <div className="flex flex-col items-center justify-center h-full">
                      <f.icon size={24} strokeWidth={1.5} style={{ color: 'var(--lv2-cyan)', marginBottom: 8 }} />
                      <span className="text-[10px] tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--lv2-text-tertiary)' }}>{f.label}</span>
                      {f.mockContent}
                    </div>
                  </div>
                </div>

                {/* Text */}
                <div>
                  {/* Mobile label */}
                  <div className="md:hidden flex items-center gap-2 mb-3" style={{ color: 'var(--lv2-cyan)' }}>
                    <span className="text-[10px] tracking-wider font-mono opacity-50">{String(i + 1).padStart(2, '0')}</span>
                    <f.icon size={16} strokeWidth={1.5} />
                    <span className="text-[11px] tracking-[0.2em] uppercase font-medium">{f.label}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 leading-tight" style={{ color: 'var(--lv2-text-primary)' }}>{f.title}</h3>
                  <p className="text-base leading-[1.7] max-w-md" style={{ color: 'var(--lv2-text-secondary)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
