import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function FinalCTASection() {
  const navigate = useNavigate();

  return (
    <section className="relative py-40 md:py-52 px-6 overflow-hidden">
      {/* Dual radial bloom */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-[45%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(30,208,231,0.1) 0%, transparent 60%)' }} />
        <div className="absolute top-[45%] left-[55%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,124,255,0.06) 0%, transparent 60%)' }} />
      </div>

      {/* Particles */}
      <div className="particles" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="particle" style={{
            width: 1.5, height: 1.5,
            top: `${(i * 41 + 10) % 100}%`, left: `${(i * 53 + 20) % 100}%`,
            '--particle-opacity': 0.04,
            '--tw-dur': `${3 + i}s`,
            '--dr-dur': `${8 + i * 2}s`,
            '--delay': `${i * 0.6}s`,
          } as React.CSSProperties} />
        ))}
      </div>

      <div className="max-w-lg mx-auto text-center relative z-10">
        <h2 className="lv2-reveal text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.08]" style={{ color: 'var(--lv2-text-primary)' }}>
          Your wardrobe has more potential than you think.
        </h2>
        <p className="lv2-reveal lv2-reveal-delay-1 text-base md:text-lg mb-12 leading-[1.7]" style={{ color: 'var(--lv2-text-secondary)' }}>
          BURS helps you unlock it with structure, styling intelligence, and a better daily experience.
        </p>
        <div className="lv2-reveal lv2-reveal-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={() => navigate('/auth')} className="lv2-cta-primary px-10 py-4 rounded-full text-sm font-semibold flex items-center gap-2">
            Start Free <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('/auth')} className="lv2-cta-ghost px-8 py-4 rounded-full text-sm font-medium">
            Sign In
          </button>
        </div>
      </div>
    </section>
  );
}
